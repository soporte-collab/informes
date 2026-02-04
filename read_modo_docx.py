import docx
import os

def read_docx(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    
    print("\n".join(full_text))

if __name__ == "__main__":
    file_path = r"e:\programacion\informes\ARCHIVOS\respuesta\pago con modo.docx"
    read_docx(file_path)
