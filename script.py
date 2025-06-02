import os
import pyperclip

def collect_files_markdown(folder_path: str) -> str:
    folder_path = os.path.abspath(folder_path)
    md_parts = []

    for root, _, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                print(f"⚠️  Skipping {file_path}: {e}")
                continue

            # 统一路径分隔符为 "/"
            full_relative_path = os.path.relpath(file_path, start=os.path.dirname(folder_path))
            full_relative_path = full_relative_path.replace(os.path.sep, "/")

            md_block = f"```\n// {full_relative_path}\n\n{content.strip()}\n```"
            md_parts.append(md_block)

    return "\n\n".join(md_parts)

if __name__ == "__main__":
    import sys

    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    markdown_output = collect_files_markdown(folder)

    pyperclip.copy(markdown_output)
    print(f"✅ Markdown string copied to clipboard. Total files: {markdown_output.count('```') // 2}")
