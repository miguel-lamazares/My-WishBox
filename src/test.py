import os
src_dir = os.getcwd()
print('src_dir:', src_dir)
with open('output.txt', 'w') as out:
    for root, dirs, files in os.walk(src_dir):
        print('Walking:', root)
        for f in files:
            if f == 'output.txt' or f == 'da o blu blu.txt':
                continue
            print(f'  File: {f}')
            filepath = os.path.join(root, f)
            rel = os.path.relpath(filepath, src_dir)
            header = f'./"src"/"{rel}"'
            out.write(header + '\n')
            with open(filepath, 'r') as inf:
                content = inf.read()
            out.write(content)
            if not content.endswith('\n'):
                out.write('\n')
            out.write('\n')