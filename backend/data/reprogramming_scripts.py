"""
Pre-written hypnosis scripts for the Reprogramming section.

Each session is assembled as:  INDUCTION  +  <topic body>  +  CLOSING

The base narration targets ~10 minutes at a slow (~90 wpm) cadence — the
frontend loops the audio and uses a sleep-timer + gentle fade-out to reach
the user's chosen duration (10 / 20 / 30 / 60 min).

The `<break time="Xs" />` tags are honoured by ElevenLabs eleven_multilingual_v2
and give the narration a natural, hypnotic pace.
"""

# Shared induction — welcome, breath work, body relaxation, staircase deepener.
INDUCTION = """Welcome. <break time="1s" /> Find a place where you can lie down… <break time="1s" /> somewhere warm… <break time="1s" /> somewhere safe. When you are ready… <break time="1s" /> let your eyes gently close.

Take a slow, deep breath in through your nose… <break time="2s" /> hold it for a moment… <break time="1s" /> and release it softly through your mouth. <break time="2s" />

Again. <break time="1s" /> Breathe in… <break time="2s" /> feel the cool air enter your body… <break time="1s" /> and exhale everything from the day. <break time="2s" />

One more slow breath in… <break time="2s" /> and a long, gentle exhale out. <break time="2s" />

With each breath, you become softer. <break time="1s" /> Heavier. <break time="1s" /> More at peace.

Bring your attention to the crown of your head. <break time="1s" /> Feel a soft, warm light begin to glow there. <break time="1s" /> Warm as sunlight on your skin.

Let that light flow into your forehead… <break time="1s" /> smoothing every thought. <break time="1s" /> Your eyes soften. <break time="1s" /> Your jaw releases. <break time="1s" /> Your tongue rests behind your teeth.

The warm light drifts into your neck… <break time="1s" /> your shoulders… <break time="1s" /> melting the weight you have carried today. <break time="1s" /> It flows down your arms, <break time="1s" /> into your hands, <break time="1s" /> all the way to your fingertips… <break time="1s" /> which now feel warm… <break time="1s" /> and heavy… <break time="1s" /> and still.

The light spreads across your chest… <break time="1s" /> into your heart… <break time="1s" /> slower now. <break time="1s" /> Softer. <break time="1s" /> It moves into your belly, <break time="1s" /> into your hips, <break time="1s" /> down through your legs, <break time="1s" /> and into your feet.

Every cell of you is now bathed in warm, golden light. <break time="2s" />

Imagine standing at the top of a beautiful staircase made of moonstone. <break time="1s" /> Ten steps lead down into a soft, silver mist below.

I will count. <break time="1s" /> With each step, you drift twice as deep. <break time="1s" />

Ten… <break time="1s" /> stepping down. <break time="1s" /> Nine… <break time="1s" /> deeper. <break time="1s" /> Eight… <break time="1s" /> softer. <break time="1s" /> Seven… <break time="1s" /> every muscle letting go. <break time="1s" /> Six… <break time="1s" /> deeper still. <break time="1s" /> Five… <break time="1s" /> halfway now. <break time="1s" /> Four… <break time="1s" /> twice as deep. <break time="1s" /> Three… <break time="1s" /> deeper. <break time="1s" /> Two… <break time="1s" /> almost there. <break time="1s" /> One… <break time="1s" /> and zero. <break time="2s" />

You have arrived. <break time="1s" /> In this place, you are completely safe. <break time="1s" /> Completely open. <break time="1s" /> Completely at peace. <break time="2s" />"""


# Shared closing / emergence — sealed, safe, drift into sleep or gentle return.
CLOSING = """<break time="2s" /> Rest here a while. <break time="1s" /> Let these words settle into your body… <break time="1s" /> into your dreams… <break time="1s" /> into the very core of who you are becoming.

You may drift into deep, restorative sleep now if you wish… <break time="1s" /> or return gently to full awareness. <break time="1s" /> Your body knows exactly what it needs.

If you choose to sleep, <break time="1s" /> know that these truths continue working within you all through the night. <break time="1s" /> Your unconscious mind is wise. <break time="1s" /> It weaves these gifts into every cell.

You are safe. <break time="1s" /> You are loved. <break time="1s" /> You are becoming exactly who you are meant to be. <break time="2s" />

Sleep… <break time="1s" /> or awaken… <break time="1s" /> gently now. <break time="1s" /> Trusting… <break time="1s" /> softly… <break time="1s" /> peacefully. <break time="2s" /> And so it is. <break time="2s" />"""


# Per-topic body — the transformational core. Each is ~450 words and repeats
# key affirmations 3-5x for subliminal reinforcement.
TOPIC_BODIES = {
    "quit-smoking": """In this quiet space, <break time="1s" /> we speak now to the part of you that once reached for the cigarette. <break time="1s" /> That part was trying to soothe you. <break time="1s" /> To comfort you. <break time="1s" /> We thank it… <break time="1s" /> and we set it free.

You do not need smoke to feel calm. <break time="1s" /> You have always had the calm inside you. <break time="1s" /> The breath itself is your medicine.

Feel it now. <break time="1s" /> A clean, deep breath filling your lungs with light. <break time="2s" /> Your body knows how to breathe. <break time="1s" /> Your body wants to breathe freely.

I am free from cigarettes. <break time="2s" /> I breathe clean, healing air. <break time="2s" /> My lungs are pink, and strong, and light. <break time="2s" />

Every craving that arises is a message. <break time="1s" /> It says — you deserve rest. <break time="1s" /> You deserve breath. <break time="1s" /> You deserve to feel alive. <break time="1s" /> And you can meet that need without smoke. <break time="1s" /> With a breath. <break time="1s" /> With a sip of water. <break time="1s" /> With a moment of stillness.

Cigarettes are behind you. <break time="2s" /> The taste, the smell, the ash — they belong to someone you used to be. <break time="1s" /> You have already stepped past them.

I am a non-smoker. <break time="2s" /> I choose breath. <break time="2s" /> I choose life. <break time="2s" />

See yourself one week from now. <break time="1s" /> Waking up. <break time="1s" /> Your breath is smooth. <break time="1s" /> Your senses are sharp. <break time="1s" /> Food tastes bright. <break time="1s" /> Your clothes smell of nothing but you.

See yourself one month from now. <break time="1s" /> Climbing stairs with ease. <break time="1s" /> Laughing without a cough. <break time="1s" /> Feeling powerful in your own skin.

See yourself one year from now. <break time="1s" /> Free. <break time="1s" /> Proud. <break time="1s" /> Grateful for this exact moment when you chose yourself.

I am free. <break time="2s" /> I am clean. <break time="2s" /> I am whole. <break time="2s" />

Whenever the old urge whispers, <break time="1s" /> you will simply breathe in through your nose… <break time="1s" /> and out through your mouth… <break time="1s" /> and the urge will pass like a small cloud crossing the sun. <break time="2s" />

Your body is healing right now. <break time="1s" /> Every cell is renewing. <break time="1s" /> Every breath is cleansing. <break time="1s" /> You are already becoming the healthiest version of yourself.

I love my lungs. <break time="2s" /> I love my breath. <break time="2s" /> I love this body that carries me. <break time="2s" />""",


    "weight-loss": """In this quiet space, <break time="1s" /> we come home to your body. <break time="1s" /> Not to fight it. <break time="1s" /> Not to punish it. <break time="1s" /> But to listen. <break time="1s" /> To love it. <break time="1s" /> To thank it for all it has carried.

Your body is not the enemy. <break time="1s" /> It is your oldest friend. <break time="1s" /> And it wants to feel light. <break time="1s" /> It wants to feel free. <break time="1s" /> It wants to feel loved.

I honour my body. <break time="2s" /> I listen to my body. <break time="2s" /> I trust my body. <break time="2s" />

From this moment on, <break time="1s" /> food becomes information. <break time="1s" /> Fuel. <break time="1s" /> Delight in small, satisfying portions. <break time="1s" /> You will notice when you are truly hungry — <break time="1s" /> a soft, empty feeling in your belly. <break time="1s" /> And you will notice when you are pleasantly full — <break time="1s" /> a quiet signal to gently stop.

I eat what nourishes me. <break time="2s" /> I stop when I am satisfied. <break time="2s" /> My body knows exactly what it needs. <break time="2s" />

Sugar and heavy foods begin to lose their pull. <break time="1s" /> You may still enjoy them from time to time — <break time="1s" /> but they no longer control you. <break time="1s" /> You are in charge.

Water becomes a joy. <break time="1s" /> Movement becomes a joy. <break time="1s" /> Rest becomes a joy.

I move my body with love. <break time="2s" /> I drink water with gratitude. <break time="2s" /> I rest without guilt. <break time="2s" />

See yourself now, <break time="1s" /> six months from tonight. <break time="1s" /> Your body is lighter. <break time="1s" /> Your energy is bright. <break time="1s" /> Your clothes fit the way you have always dreamed. <break time="1s" /> But more than that — <break time="1s" /> you feel at home inside yourself.

See yourself moving through your day with ease. <break time="1s" /> Climbing stairs, <break time="1s" /> playing, <break time="1s" /> dancing, <break time="1s" /> reaching for what you love with a strong, willing body.

I am becoming lighter. <break time="2s" /> I am becoming stronger. <break time="2s" /> I am becoming freer every day. <break time="2s" />

You do not have to earn love through your weight. <break time="1s" /> You are already, absolutely, unconditionally lovable. <break time="1s" /> And from that love — <break time="1s" /> not from shame — <break time="1s" /> your body is now free to release what it no longer needs.

Old patterns dissolve. <break time="1s" /> New patterns rise. <break time="1s" /> Your metabolism awakens. <break time="1s" /> Your body remembers its natural, radiant weight.

I release with love. <break time="2s" /> I receive with love. <break time="2s" /> I live in a body I adore. <break time="2s" />""",


    "confidence": """In this quiet space, <break time="1s" /> we speak to the part of you that has always been afraid to shine. <break time="1s" /> That part is not broken. <break time="1s" /> It was simply protecting you. <break time="1s" /> Thank it. <break time="1s" /> And gently invite it to rest.

Because a new voice is rising in you now. <break time="1s" /> The voice of your true self. <break time="1s" /> Calm. <break time="1s" /> Certain. <break time="1s" /> Kind. <break time="1s" /> And utterly unshakable.

I am worthy. <break time="2s" /> I am capable. <break time="2s" /> I belong here. <break time="2s" />

Feel a warm, glowing light in the center of your chest. <break time="1s" /> This is your inner sun. <break time="1s" /> It has always been there. <break time="1s" /> Feel it grow brighter with each breath. <break time="1s" /> Radiating warmth. <break time="1s" /> Radiating peace. <break time="1s" /> Radiating quiet, steady power.

I trust myself. <break time="2s" /> I know who I am. <break time="2s" /> I speak my truth with grace. <break time="2s" />

From this moment forward, <break time="1s" /> the opinions of others no longer shape you. <break time="1s" /> You listen. <break time="1s" /> You consider. <break time="1s" /> But you decide. <break time="1s" /> You are the author of your life.

When you enter a room, <break time="1s" /> you enter with quiet certainty. <break time="1s" /> When you speak, <break time="1s" /> people listen — <break time="1s" /> not because you demand it, <break time="1s" /> but because you speak from your true self.

I stand tall. <break time="2s" /> I speak clearly. <break time="2s" /> I am seen and I am safe. <break time="2s" />

The inner critic that once whispered you were not enough… <break time="1s" /> grows quiet now. <break time="1s" /> Its voice fades. <break time="1s" /> A wiser voice replaces it — <break time="1s" /> soft, loving, and true: <break time="1s" /> you are enough. <break time="1s" /> You have always been enough. <break time="1s" /> You always will be enough.

See yourself now, <break time="1s" /> stepping into a challenge you have long avoided. <break time="1s" /> Your heart is steady. <break time="1s" /> Your voice is clear. <break time="1s" /> You feel afraid — <break time="1s" /> and you do it anyway. <break time="1s" /> That is real confidence. <break time="1s" /> Not the absence of fear, <break time="1s" /> but the presence of your true self.

I am strong. <break time="2s" /> I am steady. <break time="2s" /> I am becoming exactly who I came here to be. <break time="2s" />

Every night, <break time="1s" /> your confidence grows deeper. <break time="1s" /> Every morning, <break time="1s" /> you wake more rooted in who you are.

I am confident. <break time="2s" /> I am worthy. <break time="2s" /> I am home in myself. <break time="2s" />""",


    "deep-sleep": """In this quiet space, <break time="1s" /> we invite the deepest, sweetest sleep to take you. <break time="1s" /> There is nothing left to do tonight. <break time="1s" /> Nothing to fix. <break time="1s" /> Nothing to solve. <break time="1s" /> You have done enough today. <break time="1s" /> You have been enough today.

Now it is time to rest.

I release the day. <break time="2s" /> I welcome the night. <break time="2s" /> Sleep comes easily to me. <break time="2s" />

Feel your body sinking. <break time="1s" /> Heavier and heavier. <break time="1s" /> Softer and softer. <break time="1s" /> The bed cradles you like a warm cloud. <break time="1s" /> The night is safe. <break time="1s" /> The night is kind.

Imagine standing at the edge of a still, dark lake. <break time="1s" /> The water is warm. <break time="1s" /> The moon is high. <break time="1s" /> You slip beneath the surface. <break time="1s" /> The water holds you. <break time="1s" /> You cannot sink too far. <break time="1s" /> You cannot get lost. <break time="1s" /> You are simply held.

Every thought that arises floats away like a leaf on the lake. <break time="1s" /> You do not need to chase it. <break time="1s" /> You do not need to solve it. <break time="1s" /> Let it drift.

My mind is quiet. <break time="2s" /> My body is heavy. <break time="2s" /> Sleep is here. <break time="2s" />

Your breath grows slower. <break time="1s" /> Your heart grows slower. <break time="1s" /> Every muscle loosens further. <break time="1s" /> Your face is soft. <break time="1s" /> Your jaw is soft. <break time="1s" /> Your hands are soft.

You will sleep deeply through the night. <break time="1s" /> You will not wake unnecessarily. <break time="1s" /> Should you stir, <break time="1s" /> you will simply return to this same silver lake, <break time="1s" /> this same warm holding, <break time="1s" /> and drift straight back into rest.

I sleep deeply. <break time="2s" /> I sleep peacefully. <break time="2s" /> I wake refreshed. <break time="2s" />

Your unconscious mind is doing its beautiful, silent work now. <break time="1s" /> It is sorting through the day. <break time="1s" /> Healing. <break time="1s" /> Growing. <break time="1s" /> Composing dreams that will guide you tomorrow.

I trust my sleep. <break time="2s" /> I trust my dreams. <break time="2s" /> I trust the night. <break time="2s" />

Feel yourself drifting further now. <break time="1s" /> Deeper than before. <break time="1s" /> A warm, dark ocean gently rocking you. <break time="1s" /> There is nowhere to be. <break time="1s" /> No thought to think. <break time="1s" /> Just this. <break time="1s" /> Just breath. <break time="1s" /> Just peace.

You are safe. <break time="1s" /> You are loved. <break time="1s" /> You are held.

Sleep now. <break time="2s" /> Sleep deeply. <break time="2s" /> Sleep well. <break time="2s" />""",


    "release-anxiety": """In this quiet space, <break time="1s" /> we speak to the part of you that has been holding so much. <break time="1s" /> The part of you that has been scanning, <break time="1s" /> worrying, <break time="1s" /> bracing for what may never come. <break time="1s" /> Thank it. <break time="1s" /> It has worked so hard to keep you safe.

You are safe now. <break time="1s" /> You are safe in this moment. <break time="1s" /> Nothing is required of you here.

I am safe. <break time="2s" /> I am here. <break time="2s" /> I am home. <break time="2s" />

Imagine your worries as small pebbles you have been carrying in your pockets. <break time="1s" /> One by one, <break time="1s" /> you gently place them down. <break time="1s" /> You do not throw them. <break time="1s" /> You do not fight them. <break time="1s" /> You simply set them down.

The bill… <break time="1s" /> set it down. <break time="1s" /> The conversation… <break time="1s" /> set it down. <break time="1s" /> Tomorrow… <break time="1s" /> set it down. <break time="1s" /> Yesterday… <break time="1s" /> set it down.

I release what I cannot control. <break time="2s" /> I trust what is unfolding. <break time="2s" /> I am at peace. <break time="2s" />

Feel your chest opening. <break time="1s" /> The tight place around your heart is softening. <break time="1s" /> Your breath is becoming deeper. <break time="1s" /> Your shoulders are dropping. <break time="1s" /> Your jaw is unclenching.

The nervous system that has been on alert for so long… <break time="1s" /> is settling now. <break time="1s" /> Signals of safety flood your body. <break time="1s" /> You are safe. <break time="1s" /> You are safe. <break time="1s" /> You are safe.

My body is calm. <break time="2s" /> My mind is calm. <break time="2s" /> My heart is calm. <break time="2s" />

When anxious thoughts return in the days ahead — <break time="1s" /> and they may — <break time="1s" /> you will greet them like an old messenger. <break time="1s" /> You will say — <break time="1s" /> thank you for trying to help. <break time="1s" /> I am safe now. <break time="1s" /> And you will breathe. <break time="1s" /> And you will feel your feet on the earth. <break time="1s" /> And the wave will pass.

Anxiety is not who you are. <break time="1s" /> It is a wave that moves through you. <break time="1s" /> Underneath the wave, <break time="1s" /> you are the vast, quiet ocean.

I am the ocean. <break time="2s" /> I am not the wave. <break time="2s" /> I am peaceful, and deep, and vast. <break time="2s" />

See yourself tomorrow. <break time="1s" /> Moving through your day with softness. <break time="1s" /> Meeting challenges with clarity, <break time="1s" /> not fear. <break time="1s" /> Breathing. <break time="1s" /> Trusting. <break time="1s" /> Being.

I am calm. <break time="2s" /> I am safe. <break time="2s" /> All is well. <break time="2s" />""",


    "abundance": """In this quiet space, <break time="1s" /> we open the doorway to abundance. <break time="1s" /> Not just money — <break time="1s" /> though money will come — <break time="1s" /> but every kind of richness. <break time="1s" /> Time. <break time="1s" /> Love. <break time="1s" /> Health. <break time="1s" /> Ease. <break time="1s" /> Opportunity.

The universe is not stingy. <break time="1s" /> It is endlessly, wildly, ridiculously generous. <break time="1s" /> And you are worthy of every bit of it.

I am worthy of abundance. <break time="2s" /> I am open to receive. <break time="2s" /> Money flows to me easily. <break time="2s" />

Feel your heart opening now. <break time="1s" /> Feel your hands opening. <break time="1s" /> Notice how tightly you have sometimes clenched them, <break time="1s" /> afraid there would not be enough.

Old fear of lack, <break time="1s" /> we thank you and release you. <break time="1s" /> You served the child who once needed you. <break time="1s" /> The adult standing here now no longer needs you. <break time="1s" /> Go in peace.

I release scarcity. <break time="2s" /> I welcome abundance. <break time="2s" /> There is more than enough for me. <break time="2s" />

See a river of golden light. <break time="1s" /> It flows straight to you. <break time="1s" /> It has always been flowing. <break time="1s" /> All that was ever required was that you open your hands.

Money is energy. <break time="1s" /> It moves easily to those who welcome it. <break time="1s" /> It runs from those who chase or fear it. <break time="1s" /> You do not chase. <break time="1s" /> You do not fear. <break time="1s" /> You simply open.

I am a magnet for wealth. <break time="2s" /> Money loves me. <break time="2s" /> I attract abundance in expected and unexpected ways. <break time="2s" />

Opportunities begin arriving. <break time="1s" /> Some small, <break time="1s" /> some enormous. <break time="1s" /> Your eyes are open. <break time="1s" /> Your instincts are sharp. <break time="1s" /> You recognize them and you say yes.

Doors open. <break time="1s" /> People appear. <break time="1s" /> Ideas arrive. <break time="1s" /> Checks arrive. <break time="1s" /> Gifts arrive.

Money comes to me. <break time="2s" /> Money comes to me easily. <break time="2s" /> Money comes to me in perfect timing. <break time="2s" />

You share your abundance generously — <break time="1s" /> because you know there is always more. <break time="1s" /> The more you give, <break time="1s" /> the more flows to you.

See yourself now, <break time="1s" /> six months from tonight. <break time="1s" /> Your bank account is fuller. <break time="1s" /> Your calendar is spacious. <break time="1s" /> Your heart is at ease. <break time="1s" /> You are not stressed about money. <break time="1s" /> You are grateful for money.

I am wealthy. <break time="2s" /> I am blessed. <break time="2s" /> I am abundant in every way. <break time="2s" />""",


    "self-love": """In this quiet space, <break time="1s" /> we come home to you. <break time="1s" /> Not the version you present. <break time="1s" /> Not the version you criticise. <break time="1s" /> Just… <break time="1s" /> you. <break time="1s" /> The you underneath everything.

Place a hand gently over your heart. <break time="1s" /> Feel it beating. <break time="1s" /> It has been beating for you your entire life. <break time="1s" /> Faithfully. <break time="1s" /> Loyally. <break time="1s" /> Without ever asking for a thing in return.

Say it now, softly in your mind — <break time="1s" /> I am here. <break time="1s" /> I love you. <break time="1s" /> I am not going anywhere.

I love myself. <break time="2s" /> I love myself. <break time="2s" /> I love myself. <break time="2s" />

Every unkind word you have ever spoken to yourself, <break time="1s" /> we forgive now. <break time="1s" /> You did not know then what you know now. <break time="1s" /> You were doing your best with what you had.

Every mistake, <break time="1s" /> every stumble, <break time="1s" /> every regret — <break time="1s" /> they are threads in a tapestry that has made you rich, <break time="1s" /> textured, <break time="1s" /> deep. <break time="1s" /> You would not be so wise, <break time="1s" /> so tender, <break time="1s" /> so real without them.

I forgive myself. <break time="2s" /> I accept myself. <break time="2s" /> I am whole exactly as I am. <break time="2s" />

You do not need to become anything to be worthy of love. <break time="1s" /> You do not need to shrink to be loved. <break time="1s" /> You do not need to expand to be loved. <break time="1s" /> You are lovable right now, <break time="1s" /> in this body, <break time="1s" /> at this weight, <break time="1s" /> at this age, <break time="1s" /> at this stage.

I am enough. <break time="2s" /> I have always been enough. <break time="2s" /> I will always be enough. <break time="2s" />

See a small child version of yourself standing before you. <break time="1s" /> Kneel down. <break time="1s" /> Look into those bright eyes. <break time="1s" /> Tell that child everything they needed to hear. <break time="1s" /> You are safe. <break time="1s" /> You are loved. <break time="1s" /> You are magic.

Now embrace them. <break time="1s" /> Feel them dissolve into your heart. <break time="1s" /> They live in you. <break time="1s" /> You are their home.

I honour my inner child. <break time="2s" /> I protect them. <break time="2s" /> I love them fiercely. <break time="2s" />

Your relationship with yourself becomes your greatest love story. <break time="1s" /> Kind words in the mirror. <break time="1s" /> Patient breaths when you falter. <break time="1s" /> Deep respect for your own limits.

I choose me. <break time="2s" /> I love me. <break time="2s" /> I am my own home. <break time="2s" />""",


    "focus": """In this quiet space, <break time="1s" /> we quiet the noise. <break time="1s" /> We invite the still, sharp clarity of your true focus to rise.

Distraction is not who you are. <break time="1s" /> Scatter is not who you are. <break time="1s" /> Beneath every restless thought, <break time="1s" /> there is a quiet, powerful engine of concentration. <break time="1s" /> That is who you truly are.

I am focused. <break time="2s" /> I am clear. <break time="2s" /> I am fully present. <break time="2s" />

Imagine a bright, still flame in the centre of your mind. <break time="1s" /> Unwavering. <break time="1s" /> Silent. <break time="1s" /> Powerful. <break time="1s" /> This flame is your focus. <break time="1s" /> It has always been there. <break time="1s" /> We are simply remembering it.

From tomorrow forward, <break time="1s" /> when you sit down to work, <break time="1s" /> your mind settles quickly. <break time="1s" /> Notifications pull less. <break time="1s" /> The urge to check, <break time="1s" /> to scroll, <break time="1s" /> to escape — <break time="1s" /> it softens.

I sit down and I begin. <break time="2s" /> I begin and I continue. <break time="2s" /> I continue and I finish. <break time="2s" />

You enter flow states easily. <break time="1s" /> Time softens. <break time="1s" /> Effort softens. <break time="1s" /> Your best work rises through you like a river.

When your mind wanders — <break time="1s" /> and it will — <break time="1s" /> you notice gently, <break time="1s" /> without judgement, <break time="1s" /> and return to the task. <break time="1s" /> This is not failure. <break time="1s" /> This is training the muscle.

My focus is a muscle. <break time="2s" /> It grows stronger every day. <break time="2s" /> Every return is a rep. <break time="2s" />

You choose one thing at a time. <break time="1s" /> One task, <break time="1s" /> one conversation, <break time="1s" /> one meal. <break time="1s" /> Presence becomes your default.

I do one thing at a time. <break time="2s" /> I am fully here. <break time="2s" /> This moment has my whole self. <break time="2s" />

See yourself tomorrow morning. <break time="1s" /> You sit down. <break time="1s" /> The most important task is in front of you. <break time="1s" /> You breathe. <break time="1s" /> You begin. <break time="1s" /> Hours melt. <break time="1s" /> The work is beautiful. <break time="1s" /> You are proud.

I am the master of my attention. <break time="2s" /> My focus is laser sharp. <break time="2s" /> My mind serves me completely. <break time="2s" />

Deep, restful sleep tonight sharpens the flame further. <break time="1s" /> You wake with clarity. <break time="1s" /> You move through your day with grace. <break time="1s" /> Nothing shakes you. <break time="1s" /> Nothing distracts you. <break time="1s" /> You are here. <break time="1s" /> Fully. <break time="1s" /> Beautifully. <break time="1s" /> Here. <break time="2s" />""",


    "release-fear": """In this quiet space, <break time="1s" /> we meet the fear that has followed you. <break time="1s" /> We do not fight it. <break time="1s" /> We do not shame it. <break time="1s" /> We sit with it… <break time="1s" /> and we thank it… <break time="1s" /> for it was born to protect you.

But you are no longer small. <break time="1s" /> You are no longer helpless. <break time="1s" /> You are grown, <break time="1s" /> and strong, <break time="1s" /> and resourced. <break time="1s" /> The fear may rest now.

I am safe. <break time="2s" /> I am strong. <break time="2s" /> I am here. <break time="2s" />

Feel a great inner courage rising in your chest. <break time="1s" /> Warm as fire. <break time="1s" /> Steady as a mountain. <break time="1s" /> This is your birthright. <break time="1s" /> This is the courage of every ancestor who survived so that you could stand here now.

You carry their strength. <break time="1s" /> You carry lifetimes of survival. <break time="1s" /> You are not fragile. <break time="1s" /> You have never been fragile.

I am courageous. <break time="2s" /> I am powerful. <break time="2s" /> I trust myself completely. <break time="2s" />

The things that have frozen you — <break time="1s" /> the phone call you have not made, <break time="1s" /> the door you have not opened, <break time="1s" /> the word you have not spoken, <break time="1s" /> the dream you have not chased — <break time="1s" /> they begin to unlock now.

You will feel afraid, <break time="1s" /> and you will do them anyway. <break time="1s" /> Fear is not a wall. <break time="1s" /> Fear is a signal that you are near something that matters.

I move forward. <break time="2s" /> I take the step. <break time="2s" /> Fear does not decide for me. <break time="2s" />

See yourself facing the very thing you fear most. <break time="1s" /> Your heart may pound. <break time="1s" /> Your palms may sweat. <break time="1s" /> And still you stand. <break time="1s" /> Still you speak. <break time="1s" /> Still you do the thing.

And on the other side of it — <break time="1s" /> freedom. <break time="1s" /> Pride. <break time="1s" /> A version of you that has stepped through the fire and been made new.

I am brave. <break time="2s" /> I am becoming free. <break time="2s" /> I am unstoppable. <break time="2s" />

You are protected. <break time="1s" /> The universe has your back. <break time="1s" /> Your ancestors have your back. <break time="1s" /> Your future self has your back.

Every step of courage is remembered. <break time="1s" /> Every small yes builds a body that says yes to bigger and bigger dreams.

I release fear. <break time="2s" /> I claim courage. <break time="2s" /> I walk forward, free. <break time="2s" />""",


    "manifest-love": """In this quiet space, <break time="1s" /> we prepare the sacred garden of your heart for the love that is already on its way to you.

Because love is not something you must earn. <break time="1s" /> Love is not something you must chase. <break time="1s" /> Love is a frequency. <break time="1s" /> A tuning. <break time="1s" /> And you are learning to tune to it now.

I am loved. <break time="2s" /> I am lovable. <break time="2s" /> I am love itself. <break time="2s" />

Feel your heart opening slowly. <break time="1s" /> An old door that has been closed for a long time. <break time="1s" /> Whatever hurt closed it, <break time="1s" /> we honour. <break time="1s" /> We thank. <break time="1s" /> We release.

The relationships of the past taught you what you no longer want. <break time="1s" /> They also taught you what you truly do want. <break time="1s" /> Every lesson has been perfect. <break time="1s" /> None of them were wasted.

I release the past. <break time="2s" /> I forgive myself. <break time="2s" /> I forgive them. <break time="2s" />

Now begin to feel your ideal partner. <break time="1s" /> Not their face. <break time="1s" /> Not their name. <break time="1s" /> The feeling of them. <break time="1s" /> Safety. <break time="1s" /> Delight. <break time="1s" /> Deep, easy laughter. <break time="1s" /> The soft feeling of being fully seen and fully chosen.

Feel their hand in yours. <break time="1s" /> Feel their eyes meeting yours across a room. <break time="1s" /> Feel the quiet of Sunday morning coffee together. <break time="1s" /> Feel the wildness of laughter that makes your stomach hurt.

They are real. <break time="1s" /> They exist. <break time="1s" /> And they are moving toward you as surely as the tide follows the moon.

My beloved is coming to me. <break time="2s" /> They are moving toward me now. <break time="2s" /> Our paths are aligning. <break time="2s" />

You do not need to force. <break time="1s" /> You do not need to chase. <break time="1s" /> You do not need to prove. <break time="1s" /> You simply need to be — <break time="1s" /> to keep loving yourself so completely that you become the exact frequency your beloved is tuned to.

I am the love I seek. <break time="2s" /> I am already whole. <break time="2s" /> My beloved is drawn to my wholeness. <break time="2s" />

See a scene now — <break time="1s" /> a year from tonight. <break time="1s" /> You and them, <break time="1s" /> curled in the soft light of evening. <break time="1s" /> Home. <break time="1s" /> Chosen. <break time="1s" /> At peace.

I am ready for love. <break time="2s" /> I welcome love. <break time="2s" /> Love is finding me now. <break time="2s" />""",


    "healing-body": """In this quiet space, <break time="1s" /> we speak directly to your body. <break time="1s" /> To every cell. <break time="1s" /> To every tissue. <break time="1s" /> To the deep, ancient intelligence that has been keeping you alive since before you could speak.

Your body is a healer. <break time="1s" /> It has been healing you your entire life. <break time="1s" /> Every cut, <break time="1s" /> every bruise, <break time="1s" /> every illness — <break time="1s" /> your body knew what to do. <break time="1s" /> It still knows.

Thank you, body. <break time="1s" /> Thank you for carrying me. <break time="1s" /> Thank you for trying so hard.

I honour my body. <break time="2s" /> I trust my body. <break time="2s" /> My body is healing. <break time="2s" />

Feel a warm, healing light entering the crown of your head. <break time="1s" /> Not a bright, harsh light — <break time="1s" /> a soft, honey-coloured glow. <break time="1s" /> It flows into every part of you that needs it.

If there is a place in your body that hurts, <break time="1s" /> gently direct the light there now. <break time="1s" /> Do not tighten around the pain. <break time="1s" /> Do not push it away. <break time="1s" /> Simply flood it with light. <break time="1s" /> With warmth. <break time="1s" /> With love.

I send love to every cell. <break time="2s" /> Every cell responds. <break time="2s" /> Every cell heals. <break time="2s" />

Your immune system is powerful. <break time="1s" /> Your nervous system is settling. <break time="1s" /> Your organs are working in beautiful, quiet harmony. <break time="1s" /> Your bones are strong. <break time="1s" /> Your blood is bright. <break time="1s" /> Your breath is deep.

Old inflammation calms. <break time="1s" /> Old tension unwinds. <break time="1s" /> Old stress dissolves. <break time="1s" /> Every night, <break time="1s" /> while you sleep, <break time="1s" /> deep restoration is unfolding within you.

I am healing. <break time="2s" /> I am strengthening. <break time="2s" /> I am becoming vibrantly well. <break time="2s" />

You cooperate with your body now. <break time="1s" /> You feed it what it needs. <break time="1s" /> You rest it when it asks. <break time="1s" /> You move it with joy. <break time="1s" /> You listen when it whispers, <break time="1s" /> so it never has to shout.

I listen to my body. <break time="2s" /> My body listens to me. <break time="2s" /> Together we heal. <break time="2s" />

See yourself six months from tonight. <break time="1s" /> Stronger. <break time="1s" /> Brighter. <break time="1s" /> Moving with ease. <break time="1s" /> Feeling more like yourself than you have in a very long time.

I am well. <break time="2s" /> I am whole. <break time="2s" /> I am radiantly alive. <break time="2s" />""",


    "release-past": """In this quiet space, <break time="1s" /> we honour the past. <break time="1s" /> We do not deny it. <break time="1s" /> We do not sugarcoat it. <break time="1s" /> We look at it directly, <break time="1s" /> and we say — <break time="1s" /> thank you. <break time="1s" /> You made me who I am. <break time="1s" /> And now… <break time="1s" /> I release you.

The moments that broke you also formed you. <break time="1s" /> The people who wounded you also taught you. <break time="1s" /> The choices you regret also grew you. <break time="1s" /> None of it was wasted. <break time="1s" /> Every thread belongs.

I honour my past. <break time="2s" /> I release my past. <break time="2s" /> I am free. <break time="2s" />

Imagine an ancient stone bowl in front of you. <break time="1s" /> It is warm. <break time="1s" /> It is safe. <break time="1s" /> Place inside it — <break time="1s" /> one by one — <break time="1s" /> every heavy thing you have carried.

The regret. <break time="1s" /> The shame. <break time="1s" /> The words you wish you had said. <break time="1s" /> The words you wish you had not said. <break time="1s" /> The relationship that ended. <break time="1s" /> The version of yourself you have outgrown.

Place them in the bowl.

Now watch a soft, silver fire rise in the bowl. <break time="1s" /> It does not destroy. <break time="1s" /> It transforms. <break time="1s" /> Every regret becomes wisdom. <break time="1s" /> Every wound becomes compassion. <break time="1s" /> Every failure becomes strength.

I forgive. <break time="2s" /> I release. <break time="2s" /> I transform. <break time="2s" />

The people you need to forgive… <break time="1s" /> you do not forgive because they deserve it. <break time="1s" /> You forgive because you deserve to be free of them.

The version of yourself you need to forgive… <break time="1s" /> did the best they could with what they knew. <break time="1s" /> Look at them with the eyes of the wisest, kindest friend. <break time="1s" /> Take their hand. <break time="1s" /> Say — <break time="1s" /> I forgive you. <break time="1s" /> I love you. <break time="1s" /> Come home.

I forgive myself. <break time="2s" /> I forgive others. <break time="2s" /> I choose peace. <break time="2s" />

The past no longer decides your future. <break time="1s" /> The past no longer defines your worth. <break time="1s" /> The past no longer holds your name.

You are new. <break time="1s" /> You are becoming. <break time="1s" /> You are free.

I am new. <break time="2s" /> I am free. <break time="2s" /> I move forward with grace. <break time="2s" />

See yourself walking out of the past like walking out of a long tunnel. <break time="1s" /> The light is soft. <break time="1s" /> The path is clear. <break time="1s" /> Something beautiful is waiting for you. <break time="1s" /> And it has been waiting all along.

I release the past. <break time="2s" /> I welcome my future. <break time="2s" /> I am free. <break time="2s" />""",
}


def build_full_script(session_id: str) -> str:
    """Assemble the full narration for a session: induction + body + closing."""
    body = TOPIC_BODIES.get(session_id)
    if not body:
        raise KeyError(f"No script defined for session '{session_id}'")
    return f"{INDUCTION}\n\n{body}\n\n{CLOSING}"
