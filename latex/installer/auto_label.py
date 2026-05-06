import os
import re
import sys

env_prefixes = {
    'definition': 'def',
    'lemma': 'lemma',
    'proposition': 'prop',
    'theorem': 'thm',
    'corollary': 'corr',
    'remark': 'mark',
    'example': 'ex',
    'note': 'note'
}

chapters_dir = 'chapters'

def format_title(title):
    title = title.lower()
    title = re.sub(r'[^a-z0-9]+', '_', title)
    return title.strip('_')

def main():
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
        target_dir = os.path.dirname(target_path) or '.'
        target_file = os.path.basename(target_path)
        files_to_check = [(target_dir, target_file)]
    else:
        if not os.path.exists(chapters_dir):
            print(f"Error: Directory '{chapters_dir}' not found.")
            return
        files_to_check = [(chapters_dir, f) for f in os.listdir(chapters_dir)]

    files_modified = 0

    for dir_path, filename in files_to_check:
        if filename.endswith('.tex'):
            filepath = os.path.join(dir_path, filename)
            if not os.path.exists(filepath):
                print(f"File not found: {filepath}")
                continue
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Pass 1: Upgrade any old-style numbers-only labels to include the section name
            current_section = format_title(filename.replace('.tex', ''))
            new_lines = []
            modified = False
            
            for line in lines:
                sec_match = re.search(r'\\(?:section|chapter)\{([^}]+)\}', line)
                if sec_match:
                    current_section = format_title(sec_match.group(1))

                # Check if it has a generic label like \label{prop:1} and is an environment begin
                label_match = re.search(r'\\label\{([a-z]+):(\d+)\}', line)
                if label_match and r'\begin{' in line:
                    prefix = label_match.group(1)
                    num = label_match.group(2)
                    new_label = f"\\label{{{prefix}:{num}_{current_section}}}"
                    old_label = f"\\label{{{prefix}:{num}}}"
                    new_line = line.replace(old_label, new_label)
                    if new_line != line:
                        modified = True
                        line = new_line
                
                new_lines.append(line)

            lines = new_lines
            content = "".join(lines)
            
            # Find all existing labels to avoid collision
            existing_labels = set(re.findall(r'\\label\{([^}]+)\}', content))
            
            # Pass 2: Inject labels for unnamed/unlabeled environments
            new_lines = []
            current_section = format_title(filename.replace('.tex', ''))
            counters = {env: 1 for env in env_prefixes}
            
            for line in lines:
                sec_match = re.search(r'\\(?:section|chapter)\{([^}]+)\}', line)
                if sec_match:
                    current_section = format_title(sec_match.group(1))
                    counters = {env: 1 for env in env_prefixes}

                if r'\begin{' in line and r'\label{' not in line:
                    match = re.search(r'\\begin\{(definition|lemma|proposition|theorem|remark|example|corollary|note)\}(?:\[(.*?)\])?', line)
                    if match:
                        env = match.group(1)
                        title = match.group(2)
                        prefix = env_prefixes[env]
                        
                        if title:
                            label_name = format_title(title)
                            label_str = f'\\label{{{prefix}:{label_name}}}'
                        else:
                            # Search for an untaken number, avoiding collision
                            while True:
                                label_name = f"{counters[env]}_{current_section}"
                                label_str = f'\\label{{{prefix}:{label_name}}}'
                                if f"{prefix}:{label_name}" not in existing_labels:
                                    break
                                counters[env] += 1
                            
                            counters[env] += 1 # increment for the next one
                        
                        insertion_point = match.end()
                        new_line = line[:insertion_point] + label_str + line[insertion_point:]
                        new_lines.append(new_line)
                        modified = True
                        
                        existing_labels.add(f"{prefix}:{label_name}")
                        continue
                        
                new_lines.append(line)
                
            if modified:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
                print(f"Updated {filename}")
                files_modified += 1

    if files_modified == 0:
        print("No files needed updating (all environments already labeled or no environments found).")
    else:
        print(f"Finished processing. modified {files_modified} files.")

if __name__ == '__main__':
    main()
