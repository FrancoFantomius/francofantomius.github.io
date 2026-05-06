import os, sys, urllib.request

def prompt_choice(prompt, choices):
    while True:
        resp = input(prompt).strip().lower()
        if resp in choices:
            return resp
        print(f"Please choose from {', '.join(choices)}.")

def download_file(url, dst_path):
    try:
        urllib.request.urlretrieve(url, dst_path)
        print(f"Downloaded {os.path.basename(dst_path)}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        sys.exit(1)

def main():
    cwd = os.getcwd()
    print("LaTeX Project Installer (runs in current directory)")
    proj_type = prompt_choice("Is this a paper or a book? (paper/book): ", ["paper", "book"]) 

    # Ensure dependencies folder exists
    dep_dir = os.path.join(cwd, "dependencies")
    os.makedirs(dep_dir, exist_ok=True)

    # Download required dependency files from remote server
    docclass = "book" if proj_type == "book" else "article"
    base_url = "https://francofantomius.com/latex/installer/dependencies/"
    for fname in ["packages.tex", f"theorems_{docclass}.tex", "MACROS.tex", "styles.sty"]:
        download_file(base_url + fname, os.path.join(dep_dir, fname))

    # Create cover.tex (locally generated)
    cover_path = os.path.join(cwd, "cover.tex")
    with open(cover_path, "w", encoding="utf-8") as f:
        f.write(r"""\begin{titlepage}
\centering
{\LARGE \textbf{My Awesome Title} \\}
\vspace{2cm}
{\large Author Name \\}
\vfill
{\large \today}
\end{titlepage}
""")
    print("Created cover.tex")

    # Create main.tex
    main_path = os.path.join(cwd, "main.tex")
    with open(main_path, "w", encoding="utf-8") as f:
        f.write(f"\\documentclass{{{docclass}}}\n")
        f.write("\\input{dependencies/packages.tex}\n")
        f.write("\\input{dependencies/styles.tex}\n")
        f.write(f"\\input{{dependencies/theorems_{docclass}.tex}}\n")
        f.write("\\input{dependencies/MACROS.tex}\n\n")
        f.write("\\begin{document}\n\n")
        f.write("\\include{cover}\n\n")
        f.write("\\tableofcontents\n\n")
        if proj_type == "book":
            f.write("\\include{chapters/chapter1}\n")
            f.write("\\include{chapters/chapter2}\n\n")
        else:
            f.write("\\section{Introduction}")
        f.write("\\end{document}\n")
    print("Created main.tex")

    # If a book, create chapter files
    if proj_type == "book":
        chapters_dir = os.path.join(cwd, "chapters")
        os.makedirs(chapters_dir, exist_ok=True)
        for i in range(1, 3):
            chap_path = os.path.join(chapters_dir, f"chapter{i}.tex")
            with open(chap_path, "w", encoding="utf-8") as cf:
                cf.write(f"\\chapter{{Chapter {i}}}\n\n% TODO: Add content here\n")
            print(f"Created {chap_path}")

    # Offer all Python scripts from remote installer directory
    scripts_dir = os.path.join(cwd, "scripts")
    os.makedirs(scripts_dir, exist_ok=True)
    # Predefined list of scripts available on the server
    remote_scripts = ["auto_label.py", "autodot.py", "clean.py", "grammar.py", "install_project.py"]
    for script in remote_scripts:
        if script == "install_project.py":
            continue
        resp = prompt_choice(f"Download script {script} to the project? (y/n): ", ["y", "n"])
        if resp == "y":
            download_file(f"https://francofantomius.com/latex/installer/{script}", os.path.join(scripts_dir, script))
    print("Installation complete.")

if __name__ == "__main__":
    main()
