"""
Tests for the new Profile / Circle / Direct Mail / Email-forward stack.

Covers:
- Profile (self + other) — fields, validation, dedupe/cap of psychic_interests
- Email-forward (sender→server proxies to recipient's hidden email)
- Direct Mail — send/inbox/sent/get(mark-read)/delete
- Circles — invite (idempotent), accept (mutual), decline, members, remove
- circle_relationship transitions on /api/profile/{other_id}
- Regression smoke: messages/users, companion-guide, subscription/plans,
                    spirit-guides/familiarity
"""
import os
import time
import uuid

import pytest
import requests

from .conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD  # noqa: F401


# ---------------------------------------------------------------------------
# Module-scoped fixtures: second user (recipient) and helpers
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def second_user():
    """Sign up a brand-new free-tier user to act as the 'other side'."""
    email = f"TEST_buddy_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass123!"
    name = "Buddy Tester"
    r = requests.post(
        f"{BASE_URL}/api/auth/signup",
        json={"email": email, "password": password, "name": name},
        timeout=30,
    )
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    r2 = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r2.status_code == 200, f"Login failed: {r2.status_code} {r2.text}"
    data = r2.json()
    return {
        "email": email,
        "password": password,
        "user_id": data["user_id"],
        "token": data["session_token"],
        "headers": {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json",
        },
    }


@pytest.fixture(scope="module")
def admin_ctx():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    d = r.json()
    return {
        "user_id": d["user_id"],
        "token": d["session_token"],
        "headers": {
            "Authorization": f"Bearer {d['session_token']}",
            "Content-Type": "application/json",
        },
    }


# ===========================================================================
# 1. Profile endpoints
# ===========================================================================
class TestProfile:
    def test_get_me_admin_shape(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/profile/me", headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text
        p = r.json()
        # must include private fields for self
        assert p.get("email") == ADMIN_EMAIL
        assert p.get("is_admin") is True
        assert p.get("is_premium") is True
        assert "created_at" in p
        # publicly required fields present
        for k in ("user_id", "name", "bio", "birthday", "location",
                  "favorite_guide", "psychic_interests"):
            assert k in p, f"missing key {k}"

    def test_put_me_full_update_and_persist(self, admin_ctx):
        payload = {
            "name": "Etheria Dev",
            "bio": "Walking the mystic path",
            "birthday": "1990-05-21",
            "location": "Asheville",
            "favorite_guide": "Selene",
            "psychic_interests": ["Tarot", "Astrology", "Mediumship"],
        }
        r = requests.put(f"{BASE_URL}/api/profile/me",
                         json=payload, headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Verify via GET
        g = requests.get(f"{BASE_URL}/api/profile/me", headers=admin_ctx["headers"])
        assert g.status_code == 200
        p = g.json()
        assert p["name"] == "Etheria Dev"
        assert p["bio"] == "Walking the mystic path"
        assert p["birthday"] == "1990-05-21"
        assert p["location"] == "Asheville"
        assert p["favorite_guide"] == "Selene"
        assert p["psychic_interests"] == ["Tarot", "Astrology", "Mediumship"]

    def test_put_me_partial_preserves_others(self, admin_ctx):
        r = requests.put(f"{BASE_URL}/api/profile/me",
                         json={"bio": "Just the bio update"},
                         headers=admin_ctx["headers"])
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/profile/me", headers=admin_ctx["headers"])
        p = g.json()
        assert p["bio"] == "Just the bio update"
        # Other fields preserved
        assert p["location"] == "Asheville"
        assert p["favorite_guide"] == "Selene"
        assert p["psychic_interests"] == ["Tarot", "Astrology", "Mediumship"]

    def test_psychic_interests_cap_and_dedupe(self, admin_ctx):
        many = ["Tarot", "tarot", "TAROT",  # all same case-insensitive
                "Astrology", "Mediumship", "Reiki", "Crystals", "Numerology",
                "Runes", "Pendulum", "I-Ching", "Palmistry", "Aura",
                "Chakras", "Dreams", "Channeling"]  # 16 raw -> dedupe to ~14 -> cap 12
        r = requests.put(f"{BASE_URL}/api/profile/me",
                         json={"psychic_interests": many},
                         headers=admin_ctx["headers"])
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/profile/me",
                         headers=admin_ctx["headers"])
        tags = g.json()["psychic_interests"]
        assert len(tags) == 12, f"Expected cap at 12, got {len(tags)}: {tags}"
        # Dedupe case-insensitive — only one of Tarot/tarot/TAROT should survive
        lowered = [t.lower() for t in tags]
        assert lowered.count("tarot") == 1
        # Restore to original three for downstream tests
        requests.put(f"{BASE_URL}/api/profile/me",
                     json={"psychic_interests": ["Tarot", "Astrology", "Mediumship"]},
                     headers=admin_ctx["headers"])

    def test_get_other_profile_hides_private(self, admin_ctx, second_user):
        r = requests.get(
            f"{BASE_URL}/api/profile/{second_user['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert "email" not in p, f"email leaked: {p}"
        assert "subscription_plan" not in p, f"subscription_plan leaked: {p}"
        assert p["user_id"] == second_user["user_id"]
        # circle_relationship initially 'none'
        assert p.get("circle_relationship") == "none", \
            f"circle_relationship expected 'none', got {p.get('circle_relationship')}"

    def test_get_other_profile_404_for_unknown(self, admin_ctx):
        r = requests.get(
            f"{BASE_URL}/api/profile/{uuid.uuid4().hex}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 404


# ===========================================================================
# 2. Email-forward
# ===========================================================================
class TestEmailForward:
    def test_email_forward_to_other_user_succeeds(self, admin_ctx, second_user):
        r = requests.post(
            f"{BASE_URL}/api/profile/{second_user['user_id']}/email",
            json={"subject": "Hello", "body": "Just testing the email proxy"},
            headers=admin_ctx["headers"],
        )
        # Accept 200 (delivered) — if Resend test mode rejects, 502 is also informative
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.json().get("success") is True

    def test_email_self_400(self, admin_ctx):
        r = requests.post(
            f"{BASE_URL}/api/profile/{admin_ctx['user_id']}/email",
            json={"subject": "Hi me", "body": "self body"},
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 400, r.text

    def test_email_empty_subject_422(self, admin_ctx, second_user):
        r = requests.post(
            f"{BASE_URL}/api/profile/{second_user['user_id']}/email",
            json={"subject": "", "body": "non-empty body"},
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 422, f"Expected 422 for empty subject: {r.status_code} {r.text}"

    def test_email_empty_body_422(self, admin_ctx, second_user):
        r = requests.post(
            f"{BASE_URL}/api/profile/{second_user['user_id']}/email",
            json={"subject": "Has subject", "body": ""},
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 422, r.text


# ===========================================================================
# 3. Direct Mail
# ===========================================================================
class TestDirectMail:
    @pytest.fixture(scope="class")
    def letter_id_holder(self):
        return {}

    def test_send_letter(self, admin_ctx, second_user, letter_id_holder):
        r = requests.post(
            f"{BASE_URL}/api/direct-mail",
            json={
                "to_user_id": second_user["user_id"],
                "subject": "Test letter",
                "body": "Hello in-app",
            },
            headers=admin_ctx["headers"],
        )
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("success") is True
        assert "letter_id" in data
        letter_id_holder["id"] = data["letter_id"]

    def test_send_self_400(self, admin_ctx):
        r = requests.post(
            f"{BASE_URL}/api/direct-mail",
            json={"to_user_id": admin_ctx["user_id"], "subject": "x", "body": "y"},
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 400, r.text

    def test_recipient_inbox_contains_letter(self, second_user, letter_id_holder):
        r = requests.get(f"{BASE_URL}/api/direct-mail/inbox",
                         headers=second_user["headers"])
        assert r.status_code == 200, r.text
        letters = r.json()["letters"]
        ids = [l["id"] for l in letters]
        assert letter_id_holder["id"] in ids, f"letter missing from inbox: {ids}"
        # Should be unread initially
        ours = next(l for l in letters if l["id"] == letter_id_holder["id"])
        assert ours["read"] is False

    def test_get_letter_marks_read_for_recipient(self, second_user, letter_id_holder):
        r = requests.get(
            f"{BASE_URL}/api/direct-mail/{letter_id_holder['id']}",
            headers=second_user["headers"],
        )
        assert r.status_code == 200, r.text
        assert r.json()["read"] is True
        # Verify persistence — re-fetch from inbox
        inbox = requests.get(f"{BASE_URL}/api/direct-mail/inbox",
                             headers=second_user["headers"]).json()["letters"]
        ours = next(l for l in inbox if l["id"] == letter_id_holder["id"])
        assert ours["read"] is True

    def test_sender_sent_contains_letter(self, admin_ctx, letter_id_holder):
        r = requests.get(f"{BASE_URL}/api/direct-mail/sent",
                         headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text
        ids = [l["id"] for l in r.json()["letters"]]
        assert letter_id_holder["id"] in ids

    def test_soft_delete_one_side_only(self, admin_ctx, second_user, letter_id_holder):
        # Sender (admin) deletes
        r = requests.delete(
            f"{BASE_URL}/api/direct-mail/{letter_id_holder['id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200, r.text
        # Admin /sent should no longer include it
        sent = requests.get(f"{BASE_URL}/api/direct-mail/sent",
                            headers=admin_ctx["headers"]).json()["letters"]
        assert letter_id_holder["id"] not in [l["id"] for l in sent]
        # Recipient /inbox should still see it
        inbox = requests.get(f"{BASE_URL}/api/direct-mail/inbox",
                             headers=second_user["headers"]).json()["letters"]
        assert letter_id_holder["id"] in [l["id"] for l in inbox], \
            "soft-delete by sender should not remove from recipient inbox"


# ===========================================================================
# 4. Circles (invite/accept/decline/members/remove)
# ===========================================================================
class TestCircles:
    @pytest.fixture(scope="class")
    def state(self):
        return {}

    def test_send_invite_self_400(self, admin_ctx):
        r = requests.post(
            f"{BASE_URL}/api/circle/invite/{admin_ctx['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 400, r.text

    def test_send_invite_sent(self, admin_ctx, second_user, state):
        r = requests.post(
            f"{BASE_URL}/api/circle/invite/{second_user['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "sent"
        assert "invite_id" in d
        state["invite_id"] = d["invite_id"]

    def test_send_invite_idempotent_already_pending(self, admin_ctx, second_user):
        r = requests.post(
            f"{BASE_URL}/api/circle/invite/{second_user['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "already_pending"

    def test_other_profile_shows_invite_pending_out(self, admin_ctx, second_user):
        r = requests.get(f"{BASE_URL}/api/profile/{second_user['user_id']}",
                         headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["circle_relationship"] == "invite_pending_out"

    def test_recipient_profile_shows_invite_pending_in(self, admin_ctx, second_user):
        r = requests.get(f"{BASE_URL}/api/profile/{admin_ctx['user_id']}",
                         headers=second_user["headers"])
        assert r.status_code == 200
        assert r.json()["circle_relationship"] == "invite_pending_in"

    def test_recipient_invites_list_contains_invite(self, second_user, state):
        r = requests.get(f"{BASE_URL}/api/circle/invites",
                         headers=second_user["headers"])
        assert r.status_code == 200, r.text
        invites = r.json()["invites"]
        ids = [i["id"] for i in invites]
        assert state["invite_id"] in ids
        # Annotated with sender info
        ours = next(i for i in invites if i["id"] == state["invite_id"])
        assert "from" in ours
        assert ours["from"].get("user_id") or ours["from"].get("name")

    def test_accept_invite_mutual_circle(self, admin_ctx, second_user, state):
        r = requests.post(
            f"{BASE_URL}/api/circle/invite/{state['invite_id']}/accept",
            headers=second_user["headers"],
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"

        # Both sides should now have each other in /circle/members
        admin_members = requests.get(
            f"{BASE_URL}/api/circle/members",
            headers=admin_ctx["headers"],
        ).json()["members"]
        assert second_user["user_id"] in [m["user_id"] for m in admin_members]

        other_members = requests.get(
            f"{BASE_URL}/api/circle/members",
            headers=second_user["headers"],
        ).json()["members"]
        assert admin_ctx["user_id"] in [m["user_id"] for m in other_members]

    def test_in_circle_relationship_both_sides(self, admin_ctx, second_user):
        r1 = requests.get(f"{BASE_URL}/api/profile/{second_user['user_id']}",
                          headers=admin_ctx["headers"])
        assert r1.json()["circle_relationship"] == "in_circle"
        r2 = requests.get(f"{BASE_URL}/api/profile/{admin_ctx['user_id']}",
                          headers=second_user["headers"])
        assert r2.json()["circle_relationship"] == "in_circle"

    def test_remove_member_mutual(self, admin_ctx, second_user):
        r = requests.delete(
            f"{BASE_URL}/api/circle/members/{second_user['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200

        admin_members = requests.get(
            f"{BASE_URL}/api/circle/members",
            headers=admin_ctx["headers"],
        ).json()["members"]
        assert second_user["user_id"] not in [m["user_id"] for m in admin_members]

        other_members = requests.get(
            f"{BASE_URL}/api/circle/members",
            headers=second_user["headers"],
        ).json()["members"]
        assert admin_ctx["user_id"] not in [m["user_id"] for m in other_members]

    def test_decline_flow(self, admin_ctx, second_user):
        # Send a new invite
        r = requests.post(
            f"{BASE_URL}/api/circle/invite/{second_user['user_id']}",
            headers=admin_ctx["headers"],
        )
        assert r.status_code == 200
        d = r.json()
        # Could be "sent" (fresh) — must not be already_in_circle since we removed
        assert d["status"] in ("sent", "already_pending"), d
        invite_id = d["invite_id"]

        # Decline
        rd = requests.post(
            f"{BASE_URL}/api/circle/invite/{invite_id}/decline",
            headers=second_user["headers"],
        )
        assert rd.status_code == 200, rd.text
        assert rd.json()["status"] == "declined"

        # No circle_members rows
        admin_members = requests.get(
            f"{BASE_URL}/api/circle/members",
            headers=admin_ctx["headers"],
        ).json()["members"]
        assert second_user["user_id"] not in [m["user_id"] for m in admin_members]

        # Relationship should be 'none' again
        r2 = requests.get(f"{BASE_URL}/api/profile/{second_user['user_id']}",
                          headers=admin_ctx["headers"])
        assert r2.json()["circle_relationship"] == "none"


# ===========================================================================
# 5. Regression smoke
# ===========================================================================
class TestRegression:
    def test_messages_users(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/messages/users",
                         headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text

    def test_companion_guide(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/companion-guide",
                         headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text

    def test_subscription_plans(self):
        r = requests.get(f"{BASE_URL}/api/subscription/plans", timeout=20)
        assert r.status_code == 200, r.text

    def test_spirit_guides_familiarity(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/spirit-guides/familiarity",
                         headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text
