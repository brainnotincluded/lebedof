import random
import subprocess
import sys

def generate_tree(n):
    """Генерирует случайное дерево с n вершинами"""
    # Для каждого города определяем детей
    tree = [[] for _ in range(n + 1)]
    parent = [0] * (n + 1)
    
    # Генерируем дерево случайным образом
    for city in range(2, n + 1):
        # Выбираем случайного родителя из уже добавленных вершин
        parent[city] = random.randint(1, city - 1)
        tree[parent[city]].append(city)
    
    return tree

def generate_test(n, q, max_children=5):
    """Генерирует тестовый случай"""
    tree = generate_tree(n)
    
    # Формируем вывод
    output = [str(n)]
    
    for city in range(1, n + 1):
        children = tree[city]
        # Ограничиваем количество детей
        if len(children) > max_children:
            children = random.sample(children, max_children)
        
        if children:
            # Перемешиваем порядок детей для разнообразия
            random.shuffle(children)
            output.append(str(len(children)) + ' ' + ' '.join(map(str, children)))
        else:
            output.append('0')
    
    # Генерируем запросы
    output.append(str(q))
    for _ in range(q):
        target = random.randint(1, n)
        output.append(str(target))
    
    return '\n'.join(output) + '\n'

def run_solution(test_input):
    """Запускает решение на C++"""
    try:
        result = subprocess.run(
            ['./railway_switches'],
            input=test_input,
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def main():
    print("Генератор стресс-тестов для БЖД 💕")
    print("=" * 50)
    
    test_cases = [
        (10, 20, 3),      # Маленький тест
        (100, 100, 5),    # Средний тест
        (1000, 1000, 7),  # Большой тест
        (5000, 5000, 10), # Очень большой тест
    ]
    
    passed = 0
    failed = 0
    
    for i, (n, q, max_children) in enumerate(test_cases, 1):
        print(f"\nТест {i}: N={n}, Q={q}, max_children={max_children}")
        
        # Генерируем несколько тестов для каждого размера
        for trial in range(3):
            test_input = generate_test(n, q, max_children)
            
            returncode, stdout, stderr = run_solution(test_input)
            
            if returncode == 0:
                lines = stdout.strip().split('\n')
                if len(lines) == q:
                    # Проверяем, что все ответы - числа
                    try:
                        for line in lines:
                            int(line)
                        print(f"  Попытка {trial + 1}: ✓ PASSED")
                        passed += 1
                    except ValueError:
                        print(f"  Попытка {trial + 1}: ✗ FAILED (некорректный формат вывода)")
                        failed += 1
                else:
                    print(f"  Попытка {trial + 1}: ✗ FAILED (неверное количество строк: {len(lines)} вместо {q})")
                    failed += 1
            else:
                print(f"  Попытка {trial + 1}: ✗ FAILED ({stderr[:50]})")
                failed += 1
    
    print("\n" + "=" * 50)
    print(f"Результаты: PASSED: {passed}, FAILED: {failed}")
    if failed == 0:
        print("Все стресс-тесты пройдены! 🎉💕")
    else:
        print(f"Есть проблемы, нужно исправлять! 💪")

if __name__ == "__main__":
    main()