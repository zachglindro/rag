import csv
import json

with open('synthetic_data.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

# Select key columns for display
columns = [
    'APN', 'Region', 'CGUARD N', 'Kernel Color', 'Kernel Type', 
    'Local Name ', 'identified resistant/tolerant', 'Province', 
    'Town/Municipality', 'Barangay', 'Days to 50% anthesis 2015',
    'Plant Height (cm)', 'Ear Height (cm)', 'Bacterial Stalk Rot',
    'Downy Mildew', 'Waterlogging', 'Drought', 'Yield'
]

# Clean and simplify data
simplified = []
for row in data:
    simplified.append({
        'APN': row.get('APN', ''),
        'Region': row.get('Region', ''),
        'CGUARD_N': row.get('CGUARD N', ''),
        'Kernel_Color': row.get('Kernel Color', ''),
        'Kernel_Type': row.get('Kernel Type', ''),
        'Local_Name': row.get('Local Name ', '').strip(),
        'Resistant_Tolerant': row.get('identified resistant/tolerant', ''),
        'Province': row.get('Province', ''),
        'Town_Municipality': row.get('Town/Municipality', ''),
        'Barangay': row.get('Barangay', ''),
        'Days_to_Anthesis': row.get('Days to 50% anthesis 2015', ''),
        'Plant_Height_cm': row.get('Plant Height (cm)', ''),
        'Ear_Height_cm': row.get('Ear Height (cm)', ''),
        'Bacterial_Stalk_Rot': row.get('Bacterial Stalk Rot', ''),
        'Downy_Mildew': row.get('Downy Mildew', ''),
        'Waterlogging': row.get('Waterlogging', ''),
        'Drought': row.get('Drought', ''),
        'Yield': row.get('Yield', '')
    })

with open('maize_data.json', 'w', encoding='utf-8') as f:
    json.dump(simplified, f, indent=2)

print(f"Converted {len(simplified)} rows to maize_data.json")
