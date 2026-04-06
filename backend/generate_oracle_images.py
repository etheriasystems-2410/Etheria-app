"""
Script to generate AI oracle card images using OpenAI gpt-image-1
Run this once to generate all card images and save them to a JSON file
"""
import asyncio
import base64
import json
import os
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

# Oracle card definitions with mystical prompts
ORACLE_CARDS = [
    # Fire Element Cards
    {"name": "The Fire Phoenix", "element": "Fire", "prompt": "Mystical phoenix bird rising from flames, glowing orange and red feathers, magical fire swirling around, dark mystical background with stars, oracle tarot card art style, ethereal and spiritual"},
    {"name": "The Flame Dancer", "element": "Fire", "prompt": "Ethereal female spirit dancing within flames, flowing fire dress, graceful pose, mystical orange and gold light, dark background with embers, oracle card art style"},
    {"name": "The Sacred Ember", "element": "Fire", "prompt": "Glowing mystical ember floating in darkness, warm orange light radiating outward, spiritual energy, sacred geometry patterns, oracle tarot card art style"},
    {"name": "The Blazing Sun", "element": "Fire", "prompt": "Magnificent golden sun with corona flames, mystical face in the sun, rays of divine light, cosmic background with stars, oracle card art style, spiritual and majestic"},
    {"name": "The Dragon's Heart", "element": "Fire", "prompt": "Glowing red crystalline dragon heart surrounded by fire, mystical scales pattern, powerful energy radiating, dark mystical background, oracle tarot card art style"},
    
    # Water Element Cards
    {"name": "The Ocean Depths", "element": "Water", "prompt": "Deep mystical ocean with bioluminescent creatures, ancient underwater temple ruins, ethereal blue light, spiritual water energy, oracle tarot card art style"},
    {"name": "The Healing Spring", "element": "Water", "prompt": "Magical glowing spring water in enchanted forest, healing light emanating from water, mystical flowers around, ethereal mist, oracle card art style, serene and spiritual"},
    {"name": "The Moon Tide", "element": "Water", "prompt": "Full moon reflecting on mystical ocean waves, silver moonlight, tidal energy, feminine spiritual power, stars above, oracle tarot card art style, magical atmosphere"},
    {"name": "The Mystic River", "element": "Water", "prompt": "Enchanted glowing river flowing through mystical forest, magical mist rising, spiritual energy in the water, ethereal blue light, oracle card art style"},
    {"name": "The Pearl of Wisdom", "element": "Water", "prompt": "Giant luminous pearl glowing with inner light, mystical underwater scene, ancient wisdom symbols, ethereal blue and silver, oracle tarot card art style"},
    
    # Earth Element Cards
    {"name": "The Ancient Tree", "element": "Earth", "prompt": "Massive ancient mystical tree with glowing roots, magical leaves, spirit faces in bark, ethereal forest, sacred grove, oracle tarot card art style, wise and grounding"},
    {"name": "The Sacred Mountain", "element": "Earth", "prompt": "Mystical mountain peak touching the stars, glowing summit, ancient stone temples, spiritual energy rising, oracle card art style, majestic and powerful"},
    {"name": "The Blooming Garden", "element": "Earth", "prompt": "Enchanted garden with magical glowing flowers, butterflies made of light, abundance energy, mystical mist, oracle tarot card art style, prosperity and growth"},
    {"name": "The Crystal Cave", "element": "Earth", "prompt": "Mystical cave filled with glowing crystals, purple and blue light, ancient magic, sacred geometry patterns, oracle tarot card art style, inner wisdom"},
    {"name": "The Stone Guardian", "element": "Earth", "prompt": "Ancient mystical stone golem guardian, covered in moss and runes, protective energy, sacred forest, oracle tarot card art style, strength and protection"},
    
    # Air Element Cards
    {"name": "The Whispering Wind", "element": "Air", "prompt": "Ethereal wind spirit with flowing form, swirling air currents, mystical whispers visible, soft blues and whites, oracle tarot card art style, messages and clarity"},
    {"name": "The Sky Dancer", "element": "Air", "prompt": "Graceful ethereal being dancing among clouds, flowing robes of mist, cosmic sky background, freedom and flight, oracle tarot card art style, liberation"},
    {"name": "The Sacred Breath", "element": "Air", "prompt": "Mystical visualization of divine breath, golden light particles, spiritual energy flow, meditation pose silhouette, oracle tarot card art style, life force"},
    {"name": "The Starlight Messenger", "element": "Air", "prompt": "Celestial messenger angel among stars, wings of light, cosmic background, carrying divine scroll, oracle tarot card art style, guidance and wisdom"},
    {"name": "The Feathered Oracle", "element": "Air", "prompt": "Mystical owl with glowing eyes, surrounded by floating feathers, ancient wisdom symbols, starry night, oracle tarot card art style, spiritual truth"},
    
    # Spirit Element Cards
    {"name": "The Third Eye", "element": "Spirit", "prompt": "Mystical third eye opening with cosmic vision, purple and indigo energy, sacred geometry, spiritual awakening, oracle tarot card art style, psychic power"},
    {"name": "The Divine Lotus", "element": "Spirit", "prompt": "Glowing lotus flower floating on mystical water, thousand petals of light, spiritual enlightenment, ethereal glow, oracle tarot card art style, purity"},
    {"name": "The Sacred Spiral", "element": "Spirit", "prompt": "Cosmic spiral galaxy merging with sacred geometry, golden ratio, infinite evolution, mystical purple and gold, oracle tarot card art style, infinity"},
    {"name": "The Celestial Gateway", "element": "Spirit", "prompt": "Mystical portal to higher dimensions, ancient stone archway with glowing runes, cosmic light beyond, oracle tarot card art style, transcendence"},
    {"name": "The Ancestor's Blessing", "element": "Spirit", "prompt": "Ethereal ancestor spirits surrounding with blessing light, ancient symbols, generational wisdom, warm golden glow, oracle tarot card art style"},
    {"name": "The Veil Between Worlds", "element": "Spirit", "prompt": "Mystical veil of mist separating two realms, spirits visible through thin barrier, ethereal twilight, oracle tarot card art style, mystery and transition"},
    {"name": "The Infinite Mirror", "element": "Spirit", "prompt": "Mystical mirror reflecting infinite versions, cosmic self-reflection, ethereal glow, sacred symbols, oracle tarot card art style, soul recognition"},
]

async def generate_card_image(image_gen: OpenAIImageGeneration, card: dict) -> str:
    """Generate a single card image and return base64 string"""
    print(f"Generating image for: {card['name']}...")
    
    try:
        images = await image_gen.generate_images(
            prompt=card['prompt'],
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            print(f"  ✓ Generated: {card['name']}")
            return image_base64
        else:
            print(f"  ✗ Failed: {card['name']} - No image returned")
            return None
    except Exception as e:
        print(f"  ✗ Error generating {card['name']}: {str(e)}")
        return None

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("Error: EMERGENT_LLM_KEY not found in environment")
        return
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    results = {}
    
    for card in ORACLE_CARDS:
        image_base64 = await generate_card_image(image_gen, card)
        if image_base64:
            results[card['name']] = {
                'element': card['element'],
                'image_base64': image_base64
            }
        
        # Small delay between requests
        await asyncio.sleep(1)
    
    # Save results to JSON file
    output_file = '/app/backend/oracle_card_images.json'
    with open(output_file, 'w') as f:
        json.dump(results, f)
    
    print(f"\nSaved {len(results)} card images to {output_file}")

if __name__ == "__main__":
    asyncio.run(main())
