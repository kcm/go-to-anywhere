#!/usr/bin/env python3
"""
Deploy Go To Anywhere (GTA) + locally installed city packs (`cities/<id>/`)
to the `gh-pages` branch on GitHub Pages without bloating `main`.

Usage:
  npm run deploy
  python3 tools/deploy-gh-pages.py
  python3 tools/deploy-gh-pages.py --cities sanfrancisco,royaloak,oakland
"""

import argparse
import os
import shutil
import subprocess
import tempfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RUNTIME_PATHS = [
    'index.html',
    'lamp.js',
    'lamp-game.js',
    'lamp-controllers.js',
    'lamp-device.js',
    'lamp-build.js',
    'js',
    'css',
    'img',
    'three',
    'assets',
    'LICENSE',
    'LICENSE-slop-newyork',
    'README.md',
]


def run(cmd, cwd=None, check=True):
    res = subprocess.run(cmd, cwd=cwd or ROOT_DIR, text=True, capture_output=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command {' '.join(cmd)} failed ({res.returncode}):\n{res.stderr or res.stdout}")
    return res


def discover_installed_cities(filter_ids=None):
    cities_dir = os.path.join(ROOT_DIR, 'cities')
    installed = []
    if not os.path.isdir(cities_dir):
        return installed
    for entry in sorted(os.listdir(cities_dir)):
        cdir = os.path.join(cities_dir, entry)
        if not os.path.isdir(cdir):
            continue
        if filter_ids and entry not in filter_ids:
            continue
        if os.path.isfile(os.path.join(cdir, 'city-geodata.js')):
            installed.append(entry)
    return installed


def dir_size_mb(path):
    total = 0
    for dp, _, fns in os.walk(path):
        for f in fns:
            total += os.path.getsize(os.path.join(dp, f))
    return total / (1024 * 1024)


def main():
    parser = argparse.ArgumentParser(description="Publish static site + installed cities/<id>/ packs to gh-pages")
    parser.add_argument('--cities', default='', help="Comma-separated list of city IDs to include (default: all installed)")
    parser.add_argument('--branch', default='gh-pages', help="Target GitHub Pages branch (default: gh-pages)")
    parser.add_argument('--remote', default='origin', help="Git remote name (default: origin)")
    args = parser.parse_args()

    filter_ids = {c.strip().lower() for c in args.cities.split(',') if c.strip()} if args.cities else None
    cities = discover_installed_cities(filter_ids)
    if not cities:
        raise SystemExit("No installed city packs found in cities/<id>/. Run `npm run city:install -- sanfrancisco` first.")

    remote_url = run(['git', 'remote', 'get-url', args.remote]).stdout.strip()
    head_sha = run(['git', 'rev-parse', '--short', 'HEAD']).stdout.strip()

    print(f"Preparing GitHub Pages bundle from commit {head_sha}...")
    print(f"Including {len(cities)} installed city pack(s): {', '.join(cities)}")

    with tempfile.TemporaryDirectory(prefix='gta-gh-pages-') as stage_dir:
        # 1. Extract tracked runtime files from HEAD via git archive so untracked/ignored files in js/ are excluded
        archive_proc = subprocess.Popen(
            ['git', 'archive', 'HEAD', *RUNTIME_PATHS],
            cwd=ROOT_DIR,
            stdout=subprocess.PIPE,
        )
        subprocess.run(['tar', '-x', '-C', stage_dir], stdin=archive_proc.stdout, check=True)
        archive_proc.wait()

        # 2. Add .nojekyll so GitHub Pages serves all files verbatim without Jekyll processing
        with open(os.path.join(stage_dir, '.nojekyll'), 'w', encoding='utf-8') as f:
            f.write('')

        # 3. Copy installed city packs into stage_dir/cities/<id>/
        stage_cities_dir = os.path.join(stage_dir, 'cities')
        os.makedirs(stage_cities_dir, exist_ok=True)
        readme_src = os.path.join(ROOT_DIR, 'cities', 'README.md')
        if os.path.isfile(readme_src):
            shutil.copy2(readme_src, os.path.join(stage_cities_dir, 'README.md'))
        local_packs_src = os.path.join(ROOT_DIR, 'cities', 'local-packs.json')
        if os.path.isfile(local_packs_src):
            shutil.copy2(local_packs_src, os.path.join(stage_cities_dir, 'local-packs.json'))

        for cid in cities:
            src_cdir = os.path.join(ROOT_DIR, 'cities', cid)
            dst_cdir = os.path.join(stage_cities_dir, cid)
            shutil.copytree(src_cdir, dst_cdir)
            print(f"  + cities/{cid:<14} ({dir_size_mb(dst_cdir):.1f} MB)")

        total_mb = dir_size_mb(stage_dir)
        print(f"Total static site size: {total_mb:.1f} MB")

        # 4. Initialize clean orphan git commit and push to remote gh-pages branch
        run(['git', 'init', '-b', args.branch], cwd=stage_dir)
        run(['git', 'add', '-A'], cwd=stage_dir)
        msg = f"Deploy Go To Anywhere ({head_sha}) with city packs: {', '.join(cities)}"
        run(['git', 'commit', '--no-verify', '-m', msg], cwd=stage_dir)
        print(f"Pushing to {remote_url} ({args.branch})...")
        run(['git', 'push', '--no-verify', '--force', remote_url, f'{args.branch}:{args.branch}'], cwd=stage_dir)
        print("Successfully pushed to gh-pages!")


if __name__ == '__main__':
    main()
