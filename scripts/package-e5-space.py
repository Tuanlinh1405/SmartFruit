"""Prepare only E5 Space source, never env/database data or local model weights."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'services/embedding'
target = root / 'tmp/hf-e5-space'
target.mkdir(parents=True, exist_ok=True)
for name in ['app.py', 'README.md', 'requirements.txt']:
    shutil.copy2(source / 'space' / name, target / name)
for name in ['model.py', 'gradio_contract.py']:
    shutil.copy2(source / name, target / name)
print(f'{target}: 5 source files, no credentials or weights')
