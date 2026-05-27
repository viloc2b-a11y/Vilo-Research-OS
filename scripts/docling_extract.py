import sys
import json
import os
import argparse

def extract_pdf_tables(file_path):
    # We will import docling here so it doesn't fail if not installed when just showing help
    from docling.document_converter import DocumentConverter
    converter = DocumentConverter()
    result = converter.convert(file_path)
    
    tables = []
    # Docling returns a document object with tables
    for table in result.document.tables:
        # Get the HTML or Markdown representation of the table
        tables.append({
            "table_html": table.export_to_html(),
            "table_markdown": table.export_to_markdown()
        })
        
    return tables

def extract_excel_tables(file_path):
    import openpyxl
    wb = openpyxl.load_workbook(file_path, data_only=True)
    tables = []
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        data = []
        for row in sheet.iter_rows(values_only=True):
            data.append([str(cell) if cell is not None else "" for cell in row])
            
        # Basic conversion to HTML table for consistency
        html = "<table>"
        for row in data:
            html += "<tr>"
            for cell in row:
                html += f"<td>{cell}</td>"
            html += "</tr>"
        html += "</table>"
        
        tables.append({
            "table_html": html,
            "table_markdown": "" # Markdown is not strictly needed if we have HTML
        })
    return tables

def main():
    parser = argparse.ArgumentParser(description='Extract tables from PDF or Excel using docling/openpyxl.')
    parser.add_argument('file_path', help='Path to the input file')
    args = parser.parse_args()
    
    file_path = args.file_path
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)
        
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.pdf']:
            tables = extract_pdf_tables(file_path)
        elif ext in ['.xlsx']:
            tables = extract_excel_tables(file_path)
        else:
            print(json.dumps({"error": f"Unsupported file extension: {ext}"}))
            sys.exit(1)
            
        print(json.dumps({"tables": tables}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
