#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int n;
    cin >> n;
    
    vector<int> parent(n + 1, 0);
    vector<int> current_switch(n + 1, 0);
    vector<vector<int>> children(n + 1);
    
    // Читаем дерево
    for (int city = 1; city <= n; city++) {
        int k;
        cin >> k;
        
        if (k > 0) {
            for (int j = 0; j < k; j++) {
                int child;
                cin >> child;
                children[city].push_back(child);
                parent[child] = city;
                
                // Первый ребенок - начальная позиция стрелки
                if (j == 0) {
                    current_switch[city] = child;
                }
            }
        }
    }
    
    // Вывод структуры дерева для отладки
    cerr << "=== Tree Structure ===" << endl;
    for (int city = 1; city <= n; city++) {
        cerr << "City " << city << ": ";
        if (children[city].empty()) {
            cerr << "no children";
        } else {
            cerr << "children: ";
            for (int child : children[city]) {
                cerr << child << " ";
            }
            cerr << "(switch -> " << current_switch[city] << ")";
        }
        cerr << ", parent: " << parent[city] << endl;
    }
    cerr << "=====================" << endl;
    
    int q;
    cin >> q;
    
    for (int i = 0; i < q; i++) {
        int target;
        cin >> target;
        
        cerr << "\n=== Query " << (i+1) << ": target=" << target << " ===" << endl;
        
        if (target < 1 || target > n) {
            cout << "-1\n";
            continue;
        }
        
        if (target == 1) {
            cout << "0\n";
            continue;
        }
        
        // Строим путь от цели к корню
        vector<int> path;
        int curr = target;
        while (curr != 0) {
            path.push_back(curr);
            curr = parent[curr];
        }
        
        // Переворачиваем, чтобы идти от корня к цели
        reverse(path.begin(), path.end());
        
        cerr << "Path: ";
        for (int p : path) cerr << p << " ";
        cerr << endl;
        
        int switches = 0;
        
        // Идем по пути
        for (int j = 0; j < (int)path.size() - 1; j++) {
            int from = path[j];
            int to = path[j + 1];
            
            cerr << "  At city " << from << ": need to go to " << to;
            cerr << ", switch points to " << current_switch[from];
            
            if (current_switch[from] != to) {
                switches++;
                current_switch[from] = to;
                cerr << " -> SWITCH! (total=" << switches << ")";
            } else {
                cerr << " -> OK";
            }
            cerr << endl;
        }
        
        cerr << "Result: " << switches << " switches" << endl;
        cout << switches << '\n';
    }
    
    return 0;
}