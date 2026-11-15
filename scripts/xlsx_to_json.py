"""Convert the weekly startup-jobs spreadsheet into a JSON list of row objects."""
import json, sys, openpyxl

def main(src, dst):
    ws = openpyxl.load_workbook(src, read_only=True).worksheets[0]
    rows, header = [], None
    for r in ws.iter_rows(values_only=True):
        if header is None:
            if r and r[0] == 'Company':
                header = list(r)
            continue
        if r and r[0]:
            rows.append({h: (str(v) if v is not None else '') for h, v in zip(header, r)})
    json.dump(rows, open(dst, 'w'))
    print(f'{len(rows)} startup rows -> {dst}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
