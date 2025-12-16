import sys
import os

def main():
    input_data = sys.stdin.buffer.read().decode().split()
    idx = 0
    
    n = int(input_data[idx])
    idx += 1
    
    parent = [0] * (n + 1)
    switch = [0] * (n + 1)
    
    for city in range(1, n + 1):
        k = int(input_data[idx])
        idx += 1
        
        if k > 0:
            switch[city] = int(input_data[idx])
            for j in range(k):
                child = int(input_data[idx])
                parent[child] = city
                idx += 1
    
    q = int(input_data[idx])
    idx += 1
    
    result = []
    
    for _ in range(q):
        target = int(input_data[idx])
        idx += 1
        
        if target < 1 or target > n:
            result.append('-1')
            continue
        
        if target == 1:
            result.append('0')
            continue
        
        count = 0
        curr = target
        
        while curr != 1:
            p = parent[curr]
            if p == 0:
                break
            if switch[p] != curr:
                count += 1
                switch[p] = curr
            curr = p
        
        result.append(str(count))
    
    sys.stdout.write('\n'.join(result) + '\n')

if __name__ == '__main__':
    main()