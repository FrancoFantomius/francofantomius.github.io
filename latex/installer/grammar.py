import glob
import re
import difflib
import ollama

def print_diff(orig, corr):
    orig_words = orig.split()
    corr_words = corr.split()
    matcher = difflib.SequenceMatcher(None, orig_words, corr_words)
    
    RED = '\033[91m'
    GREEN = '\033[92m'
    RESET = '\033[0m'
    STRIKE = '\033[9m'

    orig_markup = []
    corr_markup = []
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        o_str = " ".join(orig_words[i1:i2])
        c_str = " ".join(corr_words[j1:j2])
        
        if tag == 'equal':
            if o_str: orig_markup.append(o_str)
            if c_str: corr_markup.append(c_str)
        elif tag == 'delete':
            if o_str: orig_markup.append(f"{RED}{STRIKE}{o_str}{RESET}")
        elif tag == 'insert':
            if c_str: corr_markup.append(f"{GREEN}{c_str}{RESET}")
        elif tag == 'replace':
            if o_str: orig_markup.append(f"{RED}{STRIKE}{o_str}{RESET}")
            if c_str: corr_markup.append(f"{GREEN}{c_str}{RESET}")
            
    print("Original Text:")
    print("  " + " ".join(orig_markup))
    print("Proposed Correction:")
    print("  " + " ".join(corr_markup))

class TextProcessor:
    def __init__(self, filename):
        self.filename = filename
        with open(filename, 'r', encoding='utf-8') as f:
            self.lines = f.readlines()
        self.current_line_idx = 0
        self.modified_lines = list(self.lines)
        self.math_env = False

    def next_correction(self):
        while self.current_line_idx < len(self.lines):
            line = self.lines[self.current_line_idx]
            
            # Simple check for math block start/end
            begins_math = '\\begin{equation}' in line or '\\begin{align}' in line or '\\begin{align*}' in line or '\\[' in line
            if begins_math:
                self.math_env = True
                
            toggled_dollar = False
            if '$$' in line and line.count('$$') % 2 != 0:
                self.math_env = not self.math_env
                toggled_dollar = True
                
            ends_math = '\\end{equation}' in line or '\\end{align}' in line or '\\end{align*}' in line or '\\]' in line
            
            if self.math_env or begins_math or ends_math or toggled_dollar or line.strip() == '' or line.strip().startswith('%'):
                if ends_math:
                    self.math_env = False
                self.current_line_idx += 1
                continue
            
            # Skip lines that are just structural LaTeX commands without real English text
            if line.strip().startswith('\\') and '{' in line and not any(c.isalpha() for c in re.sub(r'\\[a-zA-Z]+\*?\{.*?\}', '', line)):
                self.current_line_idx += 1
                continue

            # Basic heuristic: if it contains almost no words, skip it (approximate without masking)
            text_only = re.sub(r'\\[a-zA-Z]+\*?(?:\[.*?\])?(?:\{.*?\})?', '', line)
            text_only = re.sub(r'\$.*?\$', '', text_only)
            if len(re.findall(r'[a-zA-Z]+', text_only)) < 3:
                self.current_line_idx += 1
                continue
                
            core = line.strip()
            
            try:
                # Correct sentenced string using gemma4 via ollama
                system_prompt = (
                    "You are an expert LaTeX grammar and spelling corrector. "
                    "Your task is to correct the grammar and spelling vocabulary of the provided English text. "
                    "IMPORTANT RULES:\n"
                    "1. Fix ONLY grammar, punctuation, and spelling errors in the English text.\n"
                    "2. DO NOT change the meaning or style of the sentence.\n"
                    "3. DO NOT output any explanations, conversational text, or prefixes. Output ONLY the corrected text.\n"
                    "4. The text contains LaTeX parts. You MUST preserve and pass all the LaTeX commands and mathematical formulas EXACTLY as they are, without modifying them.\n"
                    "5. Provide ONLY the text without any enclosing quotes or markdown formatting."
                )
                
                response = ollama.chat(model='gemma4', messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': core}
                ], options={'temperature': 0.1, 'top_p': 0.5})
                
                correction = response['message']['content'].strip()
            except Exception as e:
                # Fallback to original text on error
                correction = core
                
            # Re-apply strict original period rules just in case
            if core.endswith('.') and not correction.endswith('.'):
                correction += '.'
            elif not core.endswith('.') and correction.endswith('.'):
                correction = correction[:-1]
            
            # Check if changed
            if correction.strip() != core.strip() and correction.strip().lower() != core.strip().lower():
                return core, correction, self.current_line_idx
                    
            self.current_line_idx += 1
        return None

    def save(self):
        with open(self.filename, 'w', encoding='utf-8') as f:
            f.writelines(self.modified_lines)

def run_app():
    print("Welcome to the Gemma4 LaTeX Grammar Checker")
    files = glob.glob("chapters/*.tex")
    if not files:
        print("No .tex files found in chapters/ directory.")
        return
        
    print("Select a file:")
    for i, f in enumerate(files):
        print(f"[{i+1}] {f}")
        
    choice = input("Enter choice (or q to quit): ")
    if choice.lower() == 'q':
        return
        
    try:
        idx = int(choice) - 1
        filename = files[idx]
    except (ValueError, IndexError):
        print("Invalid choice.")
        return
        
    print(f"\nChecking {filename}...")
    processor = TextProcessor(filename)
    
    while True:
        correction_data = processor.next_correction()
        if not correction_data:
            print("\nFinished processing file!")
            processor.save()
            print("Modifications saved.")
            break
            
        orig, corr, line_idx = correction_data
        print(f"\n--- Checking line {line_idx + 1} ---")
        
        print_diff(orig, corr)
        
        while True:
            action = input("\nAction: [a]ccept, [c]ustom replace, [i]gnore, [e]xplain, [q]uit: ").strip().lower()
            if action == 'a':
                original_line = processor.lines[line_idx]
                new_line = original_line.replace(orig, corr)
                processor.modified_lines[line_idx] = new_line
                processor.current_line_idx += 1
                processor.save()
                break
            elif action == 'c':
                print(f"Original: {orig}")
                print(f"Suggested: {corr}")
                custom = input("Enter your custom text: ")
                original_line = processor.lines[line_idx]
                new_line = original_line.replace(orig, custom)
                processor.modified_lines[line_idx] = new_line
                processor.current_line_idx += 1
                processor.save()
                break
            elif action == 'i':
                processor.current_line_idx += 1
                break
            elif action == 'e':
                print("\nAsking Gemma4 for an explanation...")
                explanation_prompt = f"Explain briefly why the original text:\n'{orig}'\nwas corrected to:\n'{corr}'\nBe concise and focus on the grammar or spelling mistake."
                try:
                    response = ollama.chat(model='gemma4', messages=[
                        {'role': 'user', 'content': explanation_prompt}
                    ], options={'temperature': 0.2})
                    print(f"\nExplanation:\n{response['message']['content'].strip()}\n")
                except Exception as e:
                    print(f"\nFailed to get explanation: {e}\n")
            elif action == 'q':
                processor.save()
                print("Progress saved. Exiting.")
                return
            else:
                print("Invalid action. Please enter a, c, i, e, or q.")

if __name__ == "__main__":
    print("Initializing Ollama Gemma4 text corrector...\n")
    run_app()
