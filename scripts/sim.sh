#!/bin/bash

dir1="$1"
dir2="$2"
total_similarity=0
file_count=0

# Get list of all files (relative paths) in dir1
cd "$dir1"
find . -type f | sort > /tmp/files1.txt
cd - > /dev/null

cd "$dir2"
find . -type f | sort > /tmp/files2.txt
cd - > /dev/null

# Only consider files present in both directories
comm -12 /tmp/files1.txt /tmp/files2.txt > /tmp/common_files.txt

while read -r relpath; do
    file1="$dir1/$relpath"
    file2="$dir2/$relpath"
    # Tokenize: split on non-word chars, sort, uniq
    tokens1=$(tr -c '[:alnum:]_' '[\n*]' < "$file1" | sort | uniq)
    tokens2=$(tr -c '[:alnum:]_' '[\n*]' < "$file2" | sort | uniq)
    echo "$tokens1" > /tmp/tokens1.txt
    echo "$tokens2" > /tmp/tokens2.txt
    intersect=$(comm -12 /tmp/tokens1.txt /tmp/tokens2.txt | wc -l)
    union=$(cat /tmp/tokens1.txt /tmp/tokens2.txt | sort | uniq | wc -l)
    if [ "$union" -eq 0 ]; then
        similarity=0
    else
        similarity=$(echo "scale=4; $intersect / $union" | bc -l)
    fi
    total_similarity=$(echo "$total_similarity + $similarity" | bc)
    file_count=$((file_count + 1))
done < /tmp/common_files.txt

if [ "$file_count" -eq 0 ]; then
    echo "0"
else
    avg_similarity=$(echo "scale=4; $total_similarity / $file_count" | bc -l)
    echo "$avg_similarity"
fi
