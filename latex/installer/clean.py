import os

def clean_latex_build_files():
    # Common LaTeX build file extensions
    extensions_to_delete = [
        '.aux', '.log', '.out', '.toc', '.bbl', '.blg', '.fdb_latexmk', '.fls', '.idx', '.ilg', '.ind', '.nav', '.snm', '.vrb', '.lof', '.lot', '.run.xml', '.bcf'
    ]#'.synctex.gz' , '.pdf',
    
    files_deleted = 0
    
    # Walk through the current directory and all subdirectories
    for root, dirs, files in os.walk('.'):
        for file in files:
            if any(file.endswith(ext) for ext in extensions_to_delete):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                    print(f"Deleted: {file_path}")
                    files_deleted += 1
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}")

    if files_deleted == 0:
        print("No build files found to delete.")
    else:
        print(f"Finished cleaning. Deleted {files_deleted} files.")

if __name__ == '__main__':
    clean_latex_build_files()
