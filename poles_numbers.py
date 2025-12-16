from math import gcd
from functools import reduce

def lcm(a, b):
    """Наименьшее общее кратное двух чисел"""
    return a * b // gcd(a, b)

def lcm_list(lst):
    """НОК списка чисел"""
    return reduce(lcm, lst)

def sum_divisible(m, d, mod):
    """
    Сумма чисел от 1 до m, делящихся на d, по модулю mod
    Формула: d * (1 + 2 + ... + k) = d * k * (k + 1) / 2
    где k = m // d - количество чисел
    """
    if d > m:
        return 0
    
    k = m // d
    
    # Вычисляем k * (k + 1) / 2 аккуратно, чтобы избежать переполнения
    # Делим одно из чисел пополам (то, которое четное)
    if k % 2 == 0:
        sum_k = (k // 2) % mod * ((k + 1) % mod) % mod
    else:
        sum_k = (k % mod) * ((k + 1) // 2 % mod) % mod
    
    return (d % mod) * sum_k % mod

def solve(n, m, a):
    """
    Решение задачи с использованием принципа включений-исключений
    
    Идея: |A1 ∪ A2 ∪ ... ∪ An| = Σ|Ai| - Σ|Ai ∩ Aj| + Σ|Ai ∩ Aj ∩ Ak| - ...
    где Ai - множество чисел, делящихся на ai
    """
    MOD = 10**9 + 7
    result = 0
    
    # Перебираем все непустые подмножества множества {a1, a2, ..., an}
    for mask in range(1, 1 << n):
        subset = []
        for i in range(n):
            if mask & (1 << i):
                subset.append(a[i])
        
        # Вычисляем НОК всех элементов подмножества
        # Числа, делящиеся на все элементы подмножества, делятся на их НОК
        l = lcm_list(subset)
        
        # Вычисляем сумму чисел от 1 до m, делящихся на l
        s = sum_divisible(m, l, MOD)
        
        # Применяем принцип включений-исключений:
        # +сумма для подмножеств нечетной длины
        # -сумма для подмножеств четной длины
        if len(subset) % 2 == 1:
            result = (result + s) % MOD
        else:
            result = (result - s + MOD) % MOD
    
    return result

# Чтение входных данных
n, m = map(int, input().split())
a = list(map(int, input().split()))

# Решение и вывод
print(solve(n, m, a))