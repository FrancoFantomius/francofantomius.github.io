import os
import re

MATH_ENVS = ['equation', 'align', 'gather', 'multline', 'eqnarray', 'math', 'displaymath']
envs_str = '|'.join([env + r'\*?' for env in MATH_ENVS])

MATH_PATTERN = re.compile(
    r'(?<!\\)\$\$(.*?)(?<!\\)\$\$|' +
    r'(?<!\$)(?<!\\)\$(?!\$)(.*?)(?<!\$)(?<!\\)\$(?!\$)|' +
    r'(?<!\\)\\\[(.*?)(?<!\\)\\\]|' +
    r'(?<!\\)\\begin\{(?P<env>' + envs_str + r')\}(.*?)(?<!\\)\\end\{(?P=env)\}',
    re.DOTALL
)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = []
    last_end = 0
    changed = False

    for m in MATH_PATTERN.finditer(content):
        if m.group(1) is not None:
            content_inside = m.group(1)
            closer = '$$'
            match_type = 'display_dollar'
        elif m.group(2) is not None:
            content_inside = m.group(2)
            closer = '$'
            match_type = 'inline_dollar'
        elif m.group(3) is not None:
            content_inside = m.group(3)
            closer = '\\]'
            match_type = 'bracket'
        elif m.group(5) is not None:
            content_inside = m.group(5)
            env = m.group(4)
            closer = f'\\end{{{env}}}'
            match_type = 'env'
        else:
            continue

        trimmed_content = content_inside.rstrip()
        has_inside_punct = False
        if trimmed_content and trimmed_content[-1] in '.,;:!?':
            has_inside_punct = True

        idx = m.end()
        while idx < len(content) and content[idx].isspace():
            idx += 1

        has_outside_punct = False
        next_is_sentence_end = False

        if idx < len(content):
            next_char = content[idx]
            if next_char in '.,;:!?':
                has_outside_punct = True
            elif next_char.isupper():
                next_is_sentence_end = True
            elif content[idx:].startswith('\\end{'):
                next_is_sentence_end = True

        needs_dot = next_is_sentence_end and not has_inside_punct and not has_outside_punct

        new_content.append(content[last_end:m.start()])

        if needs_dot:
            trailing_spaces = content_inside[len(trimmed_content):]
            if match_type == 'display_dollar':
                new_math_block = f"$${trimmed_content}\\, .{trailing_spaces}$$"
            elif match_type == 'inline_dollar':
                new_math_block = f"${trimmed_content}\\, .{trailing_spaces}$"
            elif match_type == 'bracket':
                new_math_block = f"\\[{trimmed_content}\\, .{trailing_spaces}\\]"
            elif match_type == 'env':
                opener = f"\\begin{{{env}}}"
                new_math_block = f"{opener}{trimmed_content}\\, .{trailing_spaces}{closer}"
            new_content.append(new_math_block)
            changed = True
        else:
            new_content.append(m.group(0))

        last_end = m.end()

    new_content.append(content[last_end:])
    final_text = "".join(new_content)

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(final_text)
        return True
    return False

def main():
    chapters_dir = 'chapters'
    if not os.path.isdir(chapters_dir):
        print(f"Directory '{chapters_dir}' not found. Please run this script in the root directory where the '{chapters_dir}' folder exists.")
        return

    modified_files = 0
    for root, _, files in os.walk(chapters_dir):
        for file in files:
            if file.endswith('.tex'):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    print(f"Updated {filepath}")
                    modified_files += 1

    print(f"Done. Modified {modified_files} files.")

if __name__ == "__main__":
    main()
