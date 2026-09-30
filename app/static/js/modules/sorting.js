const Sorting = {
    init() {
        // Safe to call after every render: each header gets one listener only
        document.querySelectorAll('table.sortable').forEach(table => {
            table.querySelectorAll('thead tr:first-child th[data-col]').forEach(th => {
                if (th.dataset.sortBound) return;
                th.dataset.sortBound = '1';
                th.addEventListener('click', () => this.sortTable(table, th));
            });
        });
    },

    sortTable(table, th) {
        const colIndex = parseInt(th.dataset.col);
        const type = th.dataset.type || 'string';
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // First click = descending (large to small), then toggle
        const isDesc = th.classList.contains('sort-desc');
        const dir = isDesc ? 1 : -1;

        // Clear all sort classes in this table
        table.querySelectorAll('th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(dir === -1 ? 'sort-desc' : 'sort-asc');

        // Skip total/summary rows (last row if it has class total-row)
        const sortableRows = rows.filter(r => !r.classList.contains('total-row'));
        const fixedRows = rows.filter(r => r.classList.contains('total-row'));

        sortableRows.sort((a, b) => {
            // data-sort holds the raw value when the cell also shows arrows or words
            const raw = cell => cell?.dataset.sort ?? cell?.textContent.trim() ?? '';
            let aVal = raw(a.cells[colIndex]);
            let bVal = raw(b.cells[colIndex]);

            if (type === 'number') {
                aVal = parseFloat(String(aVal).replace(/[,%+—]/g, '')) || 0;
                bVal = parseFloat(String(bVal).replace(/[,%+—]/g, '')) || 0;
                return (aVal - bVal) * dir;
            }
            return aVal.localeCompare(bVal, 'he') * dir;
        });

        tbody.innerHTML = '';
        sortableRows.forEach(r => tbody.appendChild(r));
        fixedRows.forEach(r => tbody.appendChild(r));
    }
};
