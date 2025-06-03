import os
import re
import hashlib
from collections import deque

K = 5  # k-gram size
W = 4  # window size (winnowing)


def normalize_code(code):
    """Remove comments and unnecessary whitespace."""
    code = re.sub(r'//.*?$|/\*.*?\*/', '', code, flags=re.MULTILINE | re.DOTALL)
    code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)  # Python style comments
    code = re.sub(r'\s+', ' ', code)
    return code.strip()


def tokenize(code):
    return re.findall(r'\w+|[^\s\w]', code)


def k_grams(tokens, k):
    grams = []
    for i in range(len(tokens) - k + 1):
        gram = ' '.join(tokens[i:i + k])
        grams.append((i, gram))
    return grams


def hash_kgram(gram):
    return int(hashlib.sha1(gram.encode()).hexdigest(), 16)


def winnow(hashes, w):
    fingerprints = set()
    window = deque()
    min_hash = None

    for i in range(len(hashes)):
        if i >= w:
            if window and hashes[i - w] == min_hash:
                min_hash = min(window)
        window.append(hashes[i])
        if len(window) > w:
            window.popleft()
        if len(window) == w:
            min_h = min(window)
            if min_h != min_hash:
                fingerprints.add(min_h)
                min_hash = min_h

    return fingerprints


def fingerprint_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    code = normalize_code(code)
    tokens = tokenize(code)
    grams = k_grams(tokens, K)
    hashes = [hash_kgram(g[1]) for g in grams]
    return winnow(hashes, W)


def compare_files(file1, file2):
    f1 = fingerprint_file(file1)
    f2 = fingerprint_file(file2)
    if not f1 and not f2:
        return 0.0, 0, 0
    intersection = f1 & f2
    union = f1 | f2
    return (len(intersection) / len(union) if union else 0.0), len(intersection), len(union)


def collect_files(base_dir):
    all_files = {}
    for root, _, files in os.walk(base_dir):
        for f in files:
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, base_dir)
            all_files[rel_path] = path
    return all_files


def compare_directories(dir1, dir2):
    files1 = collect_files(dir1)
    files2 = collect_files(dir2)

    common_files = set(files1.keys()) & set(files2.keys())
    scores = {}
    total_intersection = 0
    total_union = 0

    for relpath in sorted(common_files):
        score, inter, union = compare_files(files1[relpath], files2[relpath])
        scores[relpath] = score
        total_intersection += inter
        total_union += union

    overall_similarity = (total_intersection / total_union) if total_union else 0.0
    return scores, overall_similarity


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <dir1> <dir2>")
        sys.exit(1)

    dir1, dir2 = sys.argv[1], sys.argv[2]
    results, overall = compare_directories(dir1, dir2)
    for rel, score in results.items():
        print(f"{rel}: {score:.4f}")
    print(f"\nOverall similarity: {overall:.4f}")
