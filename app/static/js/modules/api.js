const API = {
    async get(endpoint) {
        const res = await fetch(`/api${endpoint}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },
    summary: () => API.get('/summary'),
    managers: () => API.get('/managers'),
    departments: () => API.get('/departments'),
    topIssues: () => API.get('/issues/top'),
    criticalIssues: () => API.get('/issues/critical'),
    allIssues: () => API.get('/issues'),
    heatmap: () => API.get('/heatmap'),
    districts: () => API.get('/districts'),
};
