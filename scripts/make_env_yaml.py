with open('.env.local', encoding='utf-8') as f:
    content = f.read()

env = {}
for line in content.splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, _, v = line.partition('=')
    k, v = k.strip(), v.strip()
    if v.startswith('"') and v.endswith('"'):
        v = v[1:-1]
    if k == 'GEMINI_API_KEY':
        continue
    env[k] = v

with open('env.yaml', 'w') as f:
    for k in sorted(env):
        v = env[k]
        v = v.replace('\\', '\\\\').replace('"', '\\"')
        f.write(f'{k}: "{v}"\n')

print('env.yaml created:', sorted(env.keys()))
