import docx
import os
import json

def read_all_docx(directory):
    files = [f for f in os.listdir(directory) if f.endswith('.docx') and not f.startswith('~$')]
    results = {}
    
    for filename in files:
        file_path = os.path.join(directory, filename)
        try:
            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                full_text.append(para.text)
            results[filename] = "\n".join(full_text)
        except Exception as e:
            results[filename] = f"Error reading file: {str(e)}"
            
    for filename, content in results.items():
        print(f"--- FILE: {filename} ---")
        print(content)
        print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    directory = r"e:\programacion\informes\ARCHIVOS\respuesta"
    read_all_docx(directory)
