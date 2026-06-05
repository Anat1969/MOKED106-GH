const Heatmap = {
    render(data) {
        const { issues, data: rows } = data;
        const thead = document.querySelector('#heatmapTable thead');
        const tbody = document.querySelector('#heatmapTable tbody');

        const maxValues = {};
        issues.forEach(issue => {
            const vals = rows.map(r => r[issue] || 0);
            maxValues[issue] = Math.max(...vals);
        });

        thead.innerHTML = `<tr>
            <th data-col="0" data-type="string">רחוב / נושא <span class="sort-icon">⇅</span></th>
            ${issues.map((issue, i) => `<th data-col="${i + 1}" data-type="number">${issue} <span class="sort-icon">⇅</span></th>`).join('')}
            <th data-col="${issues.length + 1}" data-type="number">סה"כ <span class="sort-icon">⇅</span></th>
        </tr>`;

        const totals = {};
        issues.forEach(i => totals[i] = 0);
        let grandTotal = 0;

        tbody.innerHTML = rows.map(row => {
            let rowTotal = row.total || 0;
            grandTotal += rowTotal;

            return `<tr>
                <td><strong>${row.street}</strong></td>
                ${issues.map(issue => {
                    const val = row[issue] || 0;
                    totals[issue] += val;
                    const max = maxValues[issue];
                    let cls = '';
                    if (val > 0 && max > 0) {
                        const ratio = val / max;
                        if (ratio >= 0.7) cls = 'heat-high';
                        else if (ratio >= 0.4) cls = 'heat-medium';
                    }
                    return `<td class="${cls}">${val || ''}</td>`;
                }).join('')}
                <td class="total-col">${rowTotal}</td>
            </tr>`;
        }).join('');

        tbody.innerHTML += `<tr class="total-row">
            <td><strong>סכום כולל</strong></td>
            ${issues.map(i => `<td class="total-col">${totals[i]}</td>`).join('')}
            <td class="total-col"><strong>${grandTotal}</strong></td>
        </tr>`;
    }
};
