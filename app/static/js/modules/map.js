const MapView = {
    map: null,
    markers: [],
    allStreetData: [],
    currentLayer: 'calls',

    // Geocoded via Nominatim OpenStreetMap API
    STREET_COORDS: {
        'הרותם': [31.7893129, 34.6530109],
        'נתן אלבז': [31.7962168, 34.6542432],
        'שבי ציון': [31.8078972, 34.6466194],
        'אליעזר בן הורקנוס': [31.7908887, 34.6605642],
        'המעפילים': [31.8059253, 34.6503122],
        'העבודה': [31.8136639, 34.6676776],
        'הפלמ"ח': [31.8041290, 34.6607420],
        'שד רוטשילד': [31.7706210, 34.6322781],
        'קרן היסוד': [31.7958267, 34.6401611],
        'רב ינאי': [31.7868081, 34.6674331],
        'דב גור': [31.7912438, 34.6569722],
        'שמעון מזרחי': [31.7940000, 34.6555000],
        'שד תל חי': [31.7704723, 34.6246212],
        'מצדה': [31.7825130, 34.6268175],
        'כנרת': [31.7853863, 34.6340466],
        'שלמה בן יוסף': [31.7964081, 34.6578265],
        'הציונות': [31.7879254, 34.6415053],
        'רוגוזין': [31.8064865, 34.6437135],
        'העצמאות': [31.7905611, 34.6474458],
    },

    ISSUE_SLA: {
        'בדיקת ביוב': 95.8,
        'בעיות ריצוף': 87.3,
        'גזם וגרוטאות לפינוי מנוף': 97.8,
        'חיות פצועות': 100.0,
        'טפטפת / צינור השקיה קרוע': 45.6,
        'ניקיון רחובות': 97.2,
        'פינוי אשפה ביתית': 85.7,
        'פינוי פגר': 86.4,
        'רכב חונה חוסם': 98.8,
        'רכב נטוש-עם מספרים': 100.0,
    },

    init(heatmapData) {
        if (this.map) return;

        this.map = L.map('mapContainer', { zoomControl: false }).setView([31.793, 34.650], 13);
        L.control.zoom({ position: 'topleft' }).addTo(this.map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        this.processData(heatmapData);
        this.renderMarkers();
        this.bindControls();
    },

    processData(heatmapData) {
        const { data } = heatmapData;

        this.allStreetData = data.map(row => {
            const coords = this.STREET_COORDS[row.street];
            if (!coords) return null;
            const total = row.total || 0;

            const issueKeys = Object.keys(row).filter(k => k !== 'street' && k !== 'total');
            let slaSum = 0, slaWeight = 0;
            issueKeys.forEach(issue => {
                const count = row[issue] || 0;
                const sla = this.ISSUE_SLA[issue];
                if (count > 0 && sla !== undefined) {
                    slaSum += sla * count;
                    slaWeight += count;
                }
            });
            const streetSla = slaWeight > 0 ? Math.round((slaSum / slaWeight) * 10) / 10 : 90;

            return {
                name: row.street,
                lat: coords[0],
                lng: coords[1],
                total: total,
                sla: streetSla,
                details: row
            };
        }).filter(Boolean);
    },

    getTop10ForMode() {
        if (this.currentLayer === 'calls') {
            return [...this.allStreetData].sort((a, b) => b.total - a.total).slice(0, 10);
        }
        return [...this.allStreetData].sort((a, b) => a.sla - b.sla).slice(0, 10);
    },

    getCallsColor(total, max) {
        const ratio = total / max;
        if (ratio >= 0.7) return '#C62828';
        if (ratio >= 0.45) return '#EF6C00';
        if (ratio >= 0.25) return '#FFD600';
        return '#2E7D32';
    },

    getSlaColor(slaPct) {
        if (slaPct >= 95) return '#2E7D32';
        if (slaPct >= 90) return '#558B2F';
        if (slaPct >= 80) return '#EF6C00';
        return '#C62828';
    },

    renderMarkers() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        const top10 = this.getTop10ForMode();
        const isCalls = this.currentLayer === 'calls';
        const maxVal = isCalls
            ? Math.max(...top10.map(s => s.total))
            : 100;

        top10.forEach((street, idx) => {
            const color = isCalls
                ? this.getCallsColor(street.total, maxVal)
                : this.getSlaColor(street.sla);

            const ratio = isCalls ? street.total / maxVal : (101 - street.sla) / 60;
            const radius = Math.max(10, Math.min(28, 10 + ratio * 20));

            // Issue breakdown — sort by relevance to mode
            const issueKeys = Object.keys(street.details).filter(k => k !== 'street' && k !== 'total');
            const issueList = issueKeys
                .filter(k => street.details[k] > 0)
                .map(k => ({ name: k, count: street.details[k], sla: this.ISSUE_SLA[k] }));

            if (isCalls) {
                issueList.sort((a, b) => b.count - a.count);
            } else {
                issueList.sort((a, b) => (a.sla || 100) - (b.sla || 100));
            }

            const issueRows = issueList.map(iss => {
                const slaText = iss.sla !== undefined ? `${iss.sla}%` : '—';
                const slaStyle = iss.sla !== undefined && iss.sla < 80 ? 'color:#C62828;font-weight:bold' : '';
                return `<tr>
                    <td style="padding:2px 6px">${iss.name}</td>
                    <td style="padding:2px 6px;text-align:center;font-weight:bold">${iss.count}</td>
                    <td style="padding:2px 6px;text-align:center;${slaStyle}">${slaText}</td>
                </tr>`;
            }).join('');

            const headline = isCalls
                ? `#${idx + 1} בכמות פניות: ${street.total} פניות`
                : `#${idx + 1} בחריגה מתקן: ${street.sla}% עמידה`;

            const popup = `
                <div style="direction:rtl;font-family:'Segoe UI',Arial;min-width:230px">
                    <h4 style="margin:0 0 4px;color:#8B1A1A;font-size:14px">${street.name}</h4>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:bold">${headline}</p>
                    <p style="margin:0 0 6px;font-size:11px;color:#666">פניות: ${street.total} | תקן משוקלל: ${street.sla}%</p>
                    <table style="width:100%;font-size:11px;border-collapse:collapse">
                        <thead><tr style="background:#8B1A1A;color:white">
                            <th style="padding:3px 6px;text-align:right">נושא</th>
                            <th style="padding:3px 6px;text-align:center">פניות</th>
                            <th style="padding:3px 6px;text-align:center">תקן</th>
                        </tr></thead>
                        <tbody>${issueRows}</tbody>
                    </table>
                </div>`;

            const tooltipText = isCalls
                ? `${street.name}: ${street.total} פניות`
                : `${street.name}: ${street.sla}% תקן`;

            const marker = L.circleMarker([street.lat, street.lng], {
                radius: radius,
                fillColor: color,
                color: '#333',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.75
            }).addTo(this.map);

            marker.bindPopup(popup, { maxWidth: 320 });
            marker.bindTooltip(tooltipText, { direction: 'top' });
            this.markers.push(marker);
        });
    },

    bindControls() {
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.map.setZoom(parseInt(btn.dataset.zoom));
            });
        });

        document.querySelectorAll('input[name="mapLayer"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentLayer = e.target.value;
                this.renderMarkers();
            });
        });
    }
};
