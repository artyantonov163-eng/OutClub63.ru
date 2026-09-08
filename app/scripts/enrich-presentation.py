"""Apply reviewed display names and image assets without changing sporting results."""
import json
from pathlib import Path

def enrich(data, root):
    config_path = root / 'private/data/presentation.json'
    config = json.loads(config_path.read_text()) if config_path.exists() else {}
    for player in data['players']:
        player.setdefault('sourceName', player['name'])
        entry = config.get('players', {}).get(player['id'], {})
        player['name'] = entry.get('name', player['sourceName'])
        player['aliases'] = list(dict.fromkeys([player['sourceName'], *entry.get('aliases', [])]))
        if entry.get('bio'): player['bio'] = entry['bio']
        portrait = root / 'private/media/portraits' / (player['id'] + '.webp')
        if portrait.is_file(): player['portrait'] = '/media/portraits/' + portrait.name
    for event in data['tournaments']:
        entry = config.get('tournaments', {}).get(event['id'], {})
        if entry.get('cover'): event['cover'] = entry['cover']
    variants_path = root / 'private/data/image-variants.json'
    if variants_path.exists(): data['imageVariants'] = json.loads(variants_path.read_text())
    return data

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    data_path = root / 'private/data/club.json'
    data = enrich(json.loads(data_path.read_text()), root)
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print('Presentation updated; sporting results unchanged.')
