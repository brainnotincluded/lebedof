def ring_distance(x, y, n):
    """Вычисляет расстояние между станциями x и y на кольце из n станций"""
    diff = abs(x - y)
    return min(diff, n - diff)

def shortest_path(u, v, n, a, b):
    """Находит кратчайший путь между станциями u и v"""
    if u == v:
        return 0
    
    # Вариант 1: прямой путь по кольцу без использования перегона
    direct = ring_distance(u, v, n)
    
    # Вариант 2: использование перегона a -> b
    # Путь: u -> a (по кольцу) -> b (по перегону) -> v (по кольцу)
    via_a_b = ring_distance(u, a, n) + 1 + ring_distance(b, v, n)
    
    # Вариант 3: использование перегона b -> a
    # Путь: u -> b (по кольцу) -> a (по перегону) -> v (по кольцу)
    via_b_a = ring_distance(u, b, n) + 1 + ring_distance(a, v, n)
    
    # Возвращаем минимальный из трёх вариантов
    return min(direct, via_a_b, via_b_a)

# Чтение входных данных
n, a, b = map(int, input().split())
q = int(input())

# Обработка запросов
for _ in range(q):
    u, v = map(int, input().split())
    
    # Если станции совпадают, выводим -1 (как указано в условии)
    if u == v:
        print(-1)
    else:
        result = shortest_path(u, v, n, a, b)
        print(result)