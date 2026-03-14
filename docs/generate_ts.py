import csv
import json

with open('synthetic_data.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

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

# Generate TypeScript file
ts_content = '''export interface MaizeData {
  APN: string
  Region: string
  CGUARD_N: string
  Kernel_Color: string
  Kernel_Type: string
  Local_Name: string
  Resistant_Tolerant: string
  Province: string
  Town_Municipality: string
  Barangay: string
  Days_to_Anthesis: string
  Plant_Height_cm: string
  Ear_Height_cm: string
  Bacterial_Stalk_Rot: string
  Downy_Mildew: string
  Waterlogging: string
  Drought: string
  Yield: string
}

export const maizeData: MaizeData[] = ''' + json.dumps(simplified, indent=2) + '''
'''

with open('../apps/frontend/lib/csv-data.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Generated csv-data.ts with {len(simplified)} rows")
