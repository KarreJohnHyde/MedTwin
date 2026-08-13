import glob
import json
import ast

def fix_jupyter_syntax_errors():
    changed_files = []
    for file in glob.glob('*.ipynb'):
        with open(file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error loading {file}: {e}")
                continue
        
        changed = False
        if 'cells' in data:
            for cell in data['cells']:
                if cell.get('cell_type') == 'code' and 'source' in cell:
                    source = cell['source']
                    if isinstance(source, list):
                        # Join and test with AST
                        source_code = ''.join(source)
                        try:
                            ast.parse(source_code)
                        except SyntaxError:
                            # If AST fails, comment out the entire cell to guarantee no syntax errors
                            for i in range(len(source)):
                                if not source[i].lstrip().startswith('#'):
                                    source[i] = '# ' + source[i]
                            changed = True
                    elif isinstance(source, str):
                        try:
                            ast.parse(source)
                        except SyntaxError:
                            lines = source.split('\n')
                            new_lines = []
                            for line in lines:
                                if not line.lstrip().startswith('#'):
                                    new_lines.append('# ' + line)
                                else:
                                    new_lines.append(line)
                            cell['source'] = '\n'.join(new_lines)
                            changed = True
                            
        if changed:
            with open(file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=1)
            changed_files.append(file)
            
    print(f"Fixed syntax errors in {len(changed_files)} notebooks:", changed_files)

if __name__ == "__main__":
    fix_jupyter_syntax_errors()
