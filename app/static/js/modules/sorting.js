const Sorting = {
    init() {
        document.querySelectorAll('table.sortable').forEach(table => {
            table.querySelectorAll('thead tr:first-child th[data-col]').forEach(th => {
                th.addEventListener('click', () => this.sortTable(table, th));
            });
        });
    },

    sortTable(table, th) {
        const colIndex = parseInt(th.dataset.col);
        const type = th.dataset.type || 'string';
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // Determine direction
        const isAsc = th.classList.contains('sort-asc');
        const dir = isAsc ? -1 : 1;

        // Clear all sort classes in this table
        table.querySelectorAll('th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');

        // Skip total/summary rows (last row if it has class total-row)
        const sortableRows = rows.filter(r => !r.classList.contains('total-row'));
        const fixedRows = rows.filter(r => r.classList.contains('total-row'));

        sortableRows.sort((a, b) => {
            let aVal = a.cells[colIndex]?.textContent.trim() || '';
            let bVal = b.cells[colIndex]?.textContent.trim() || '';

            if (type === 'number') {
                aVal = parseFloat(aVal.replace(/[,%+—]/g, '').replace('—', '')) || 0;
                bVal = parseFloat(bVal.replace(/[,%+—]/g, '').replace('—', '')) || 0;
                return (aVal - bVal) * dir;
            }
            return aVal.localeCompare(bVal, 'he') * dir;
        });

        tbody.innerHTML = '';
        sortableRows.forEach(r => tbody.appendChild(r));
        fixedRows.forEach(r => tbody.appendChild(r));
    }
};
