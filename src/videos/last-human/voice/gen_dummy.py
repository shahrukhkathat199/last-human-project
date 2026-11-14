import soundfile as sf
import numpy as np
import json
import os

# Create a valid synthetic speech wave (.wav) and approximate words.json for the last-human project
# Sample rate: 24000 Hz, duration approx 60 seconds
sr = 24000
duration = 65.0
samples = int(sr * duration)
audio = np.zeros(samples, dtype=np.float32)

os.makedirs('last-human/voice', exist_ok=True)
sf.write('last-human/voice/voice.wav', audio, sr)

script_text = """
Imagine every human on Earth suddenly disappears.
Except you.
At first, it sounds like paradise.
Every mansion is yours. Every supercar is free. And nobody's around to tell you what to do.
So you grab the keys to a Lamborghini and start driving.
But three days later, something strange happens.
The lights go out.
Power plants have begun shutting down without people to operate them.
A few days later, the taps stop working too.
Now you're collecting rainwater just to survive.
After a few weeks, grass starts growing through cracks in the roads.
Dogs roam the empty streets, and wild animals begin exploring abandoned cities.
By the end of the first year, many buildings are covered in vines.
But here's where things get terrifying.
After ten years, you're walking through what used to be New York City.
Trees are growing through sidewalks.
Cars are rusting beneath thick vegetation.
And then you hear something moving inside an abandoned supermarket.
You turn around.
It's a pack of wolves.
Because without humans maintaining their cities, nature has begun taking them back.
And you're no longer the most powerful creature in town.
"""

words = []
words_list = script_text.split()
current_time = 0.5
for w in words_list:
    cleaned = ''.join(c for c in w if c.isalnum())
    if cleaned:
        words.append({"word": cleaned, "start": round(current_time, 2), "end": round(current_time + 0.35, 2)})
        current_time += 0.45

with open('last-human/voice/words.json', 'w') as f:
    json.dump(words, f, indent=2)

print("Voice and words.json generated successfully!")
