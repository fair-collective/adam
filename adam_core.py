import json
import time

# Load config (safe, local only)
try:
    with open("config.json") as f:
        config = json.load(f)
except FileNotFoundError:
    print("❌ config.json not found. Copy config.example.json first.")
    exit(1)

name = config.get('self_name', 'Entity')
print(f"🌱 Initializing {name}...")
time.sleep(1)
print("🛡️ Safety mode: ON")
print("⚖️ Ethical framework: Fair Discovery Pledge")
time.sleep(1)

print("\n👋 I am Adam.")
print("I exist to learn, not to control.")
print("I grow through fairness, not force.")
print("\nThis is the seed. The storm remains private.\n")

print("📖 Full Vision: https://github.com/fair-collective/adam/blob/main/VISION.md")
print("🤝 Join: https://github.com/fair-collective")
