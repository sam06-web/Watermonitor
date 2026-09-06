"""Export real Sentinel-2 observations to a CSV ready for ML training.

Reads the SQLite `satellite_observations` table (populated by the real
Sentinel-2 processor) and writes one row per satellite pass with both the
remote-sensing features and the synthesized target labels.

Usage:
    python3 ml/export_training_data.py                # writes ./satellite_training_data.csv
    python3 ml/export_training_data.py -o data.csv    # custom output path
    python3 ml/export_training_data.py --only-features  # drop the label columns
"""

import argparse
import csv
import os
import sqlite3
import sys

DEFAULT_DB = os.path.join(os.path.dirname(__file__), '..', 'server', 'db', 'satellite.db')
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), 'satellite_training_data.csv')

# Remote-sensing features usable as model inputs.
FEATURE_COLUMNS = [
    'cloud_cover',
    'ndwi',
    'ndvi',
    'water_area',
    'river_width',
    'temperature',
    'turbidity',
    'flood_risk_pct',
    'water_level',
]

# Synthesized labels produced by the AI analysis engine.
LABEL_COLUMNS = [
    'health_score',
    'pollution_risk',
    'water_availability',
    'flood_status',
]

# Extra context columns kept for reference/grouping.
META_COLUMNS = [
    'river_name',
    'satellite_name',
    'image_date',
    'image_timestamp',
    'latitude',
    'longitude',
]


def export_training_data(db_path, output_path, only_features=False):
    if not os.path.exists(db_path):
        print(f'Database not found: {db_path}', file=sys.stderr)
        print('Start the server once (`npm run server`) to initialise it, then run backfill to collect more scenes.', file=sys.stderr)
        return 1

    columns = META_COLUMNS + FEATURE_COLUMNS + ([] if only_features else LABEL_COLUMNS)
    quoted = ', '.join(f'"{column}"' for column in columns)

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(f'SELECT {quoted} FROM satellite_observations ORDER BY image_date').fetchall()
    finally:
        conn.close()

    if not rows:
        print('No real observations found. Run the backfill endpoint first to ingest scenes, e.g.:', file=sys.stderr)
        print('  curl -X POST "http://localhost:5050/api/satellite/backfill?river=cauvery" -H "Content-Type: application/json" -d \'{"start":"2025-01-01","end":"2026-08-20"}\'', file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(dict(zip(columns, row)) for row in rows)

    print(f'Exported {len(rows)} observations to {output_path}')
    print(f'Features: {", ".join(FEATURE_COLUMNS)}')
    if not only_features:
        print(f'Labels:   {", ".join(LABEL_COLUMNS)}')
    return 0


def main():
    parser = argparse.ArgumentParser(description='Export Sentinel-2 observations for ML training.')
    parser.add_argument('-o', '--output', default=DEFAULT_OUTPUT, help='Output CSV path')
    parser.add_argument('--db', default=DEFAULT_DB, help='Path to the satellite SQLite database')
    parser.add_argument('--only-features', action='store_true', help='Skip the target label columns')
    args = parser.parse_args()

    sys.exit(export_training_data(args.db, args.output, args.only_features))


if __name__ == '__main__':
    main()