# lebedof

Небольшой набор решений задач (Python/C++).
Все решения читают входные данные из **stdin** и пишут ответ в **stdout**.

## Содержимое репозитория

### Берляндские железные дороги (БЖД)
- `railway_switches.cpp` — основное (оптимизированное) решение на C++17
- `railway_switches.py` — версия на Python
- `debug_solution.cpp` — отладочная версия (пишет подробности в stderr)
- `stress_test_generator.py` — генератор стресс‑тестов (ожидает скомпилированный `./railway_switches`)
- `README_SOLUTION.md` — подробное описание идеи решения и примеры запуска
- `test_railway1.txt`, `test_railway2.txt` — примеры тестов

### Другие решения
- `metro_ring.py` — поиск кратчайшего пути на кольцевой линии с дополнительным перегоном
- `poles_numbers.py` — задача на включения‑исключения (сумма чисел, делящихся на хотя бы одно из `a[i]`, по модулю `1e9+7`)

## Быстрый старт

### C++ (railway_switches.cpp)
Скомпилировать:

```bash
g++ -O2 -std=c++17 railway_switches.cpp -o railway_switches
```

Запустить на примере:

```bash
./railway_switches < test_railway1.txt
```

### Python
Запуск любого решения на Python выглядит так:

```bash
python3 metro_ring.py < input.txt
```

Например:

```bash
python3 poles_numbers.py < test_poles.txt
```

### Стресс‑тесты для БЖД
1) Скомпилируйте `railway_switches.cpp` (см. выше)
2) Запустите генератор:

```bash
python3 stress_test_generator.py
```

## Как добавить новое решение
1) Добавьте файл `*.py` или `*.cpp` в корень репозитория (или создайте папку `solutions/` и переносите туда — как вам удобнее).
2) Убедитесь, что решение читает из stdin и пишет в stdout.
3) Добавьте один‑два примера входных данных в `test_*.txt`.
4) Обновите этот `README.md`, чтобы было понятно, что где лежит и как запускать.

## Примечания
- Папки `.venv/`, `.idea/`, `.vscode/` и артефакты сборки игнорируются через `.gitignore` и не должны попадать в GitHub.
