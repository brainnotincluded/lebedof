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
    
    for (int city = 1; city <= n; city++) {
        int k;
        cin >> k;
        
        if (k > 0) {
            int first_child;
            cin >> first_child;
            current_switch[city] = first_child;
            parent[first_child] = city;
            
            for (int j = 1; j < k; j++) {
                int child;
                cin >> child;
                parent[child] = city;
            }
        }
    }
    
    int q;
    cin >> q;
    
    for (int i = 0; i < q; i++) {
        int target;
        cin >> target;
        
        if (target < 1 || target > n) {
            cout << "-1\n";
            continue;
        }
        
        if (target == 1) {
            cout << "0\n";
            continue;
        }
        
        // Строим путь от корня к цели
        vector<int> path;
        int curr = target;
        while (curr != 0) {
            path.push_back(curr);
            curr = parent[curr];
        }
        
        // Переворачиваем путь, чтобы идти от корня к цели
        reverse(path.begin(), path.end());
        
        int switches = 0;
        
        // Идем по пути от корня к цели
        for (int j = 0; j < (int)path.size() - 1; j++) {
            int from = path[j];
            int to = path[j + 1];
            
            if (current_switch[from] != to) {
                switches++;
                current_switch[from] = to;
            }
        }
        
        cout << switches << '\n';
    }
    
    return 0;
}