// AgriGuard AI - App Logic

document.addEventListener('DOMContentLoaded', () => {
    // SPA Routing & Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const mainTabs = document.querySelectorAll('.main-tab');

    let yieldChartInstance = null;
    let waterChartInstance = null;

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            mainTabs.forEach(t => t.style.display = 'none');
            document.getElementById(targetId).style.display = 'block';
            window.scrollTo(0, 0);

            if(targetId === 'tab-irrigation' && !waterChartInstance) initWaterChart();
            if(targetId === 'tab-yield' && !yieldChartInstance) initYieldChart();
        });
    });

    const waterElement = document.querySelector('.water');
    const percentElement = document.querySelector('.percentage');
    let level = 65;
    
    setInterval(() => {
        const newLevel = level + (Math.random() > 0.5 ? 1 : -1);
        if (newLevel > 60 && newLevel < 70) {
            level = newLevel;
            if(waterElement) waterElement.style.height = `${level}%`;
            if(percentElement) percentElement.textContent = `${level}%`;
        }
    }, 5000);

    const ctx = document.getElementById('detectionChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); 
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const detectionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Average Detection Confidence (%)',
                data: [82, 85, 89, 87, 92, 94, 96],
                borderColor: '#10b981',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#10b981',
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                y: { min: 70, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
            },
            animation: { duration: 2000, easing: 'easeOutQuart' }
        }
    });

    // Database Integration: Load Scans
    async function loadScans() {
        try {
            const response = await fetch('/api/scans');
            if(!response.ok) return;
            const scans = await response.json();
            
            const tableBody = document.getElementById('scanTableBody');
            const scanList = document.querySelector('.scan-list');
            
            if (scans.length > 0) {
                tableBody.innerHTML = '';
                scanList.innerHTML = '';
            }

            scans.forEach(scan => {
                const isHealthy = scan.status === 'Healthy';
                const tr = document.createElement('tr');
                tr.className = 'table-row';
                const timeStr = new Date(scan.timestamp + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                tr.innerHTML = `
                    <td>Today, ${timeStr}</td>
                    <td><i class="fa-solid fa-seedling" style="color: #10b981;"></i> ${scan.crop_type}</td>
                    <td>Sector ${scan.sector}</td>
                    <td><span class="badge ${isHealthy ? 'healthy' : 'danger'}">${scan.status}</span></td>
                    <td>
                        <div class="progress-bar"><div class="progress" style="width: ${scan.confidence}%; background: ${isHealthy ? 'var(--success)' : 'var(--danger)'};"></div></div>
                        <span class="progress-text">${scan.confidence}%</span>
                    </td>
                    <td><button class="btn-icon"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
                `;
                tableBody.appendChild(tr);

                const div = document.createElement('div');
                div.className = 'scan-item';
                const imgStyle = scan.image_path ? `background-image: url('${scan.image_path}'); background-size: cover;` : `background-color: var(--primary);`;
                div.innerHTML = `
                    <div class="scan-img" style="${imgStyle}"></div>
                    <div class="scan-details">
                        <h4 style="color:var(--text-main)">${scan.crop_type} - Sector ${scan.sector}</h4>
                        <p>Detected: <span class="badge ${isHealthy ? 'healthy' : 'danger'}">${scan.status} (${scan.confidence}%)</span></p>
                    </div>
                    <div class="scan-time" style="color:var(--text-muted)">${timeStr}</div>
                `;
                scanList.appendChild(div);
            });
            
            const selectEl = document.getElementById('headerLangSelect');
            if (selectEl && typeof translatePage === 'function') {
                translatePage(selectEl.value);
            }
        } catch(e) {
            console.error('Failed to load scans', e);
        }
    }
    
    loadScans();

    const modal = document.getElementById('scanModal');
    const openBtn = document.getElementById('openScanModal');
    const closeBtn = document.querySelector('.close-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const cameraTab = document.getElementById('cameraTab');
    const uploadTab = document.getElementById('uploadTab');
    const scanResult = document.getElementById('scanResult');
    
    const cameraFeed = document.getElementById('cameraFeed');
    const captureBtn = document.getElementById('captureBtn');
    let stream = null;

    const fileUpload = document.getElementById('fileUpload');
    const dropZone = document.getElementById('dropZone');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');

    openBtn.addEventListener('click', () => {
        modal.classList.add('show');
        resetModal();
        if (cameraTab.style.display !== 'none') startCamera();
    });

    const closeModal = () => {
        modal.classList.remove('show');
        stopCamera();
    };
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const tab = e.target.getAttribute('data-tab');
            if (tab === 'camera') {
                cameraTab.style.display = 'block';
                uploadTab.style.display = 'none';
                startCamera();
            } else {
                cameraTab.style.display = 'none';
                uploadTab.style.display = 'block';
                stopCamera();
            }
            scanResult.style.display = 'none';
        });
    });

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraFeed.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera:", err);
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    // NEW REAL CAMERA LOGIC
    captureBtn.addEventListener('click', () => {
        // Draw the current video frame to a hidden canvas
        const canvas = document.createElement('canvas');
        canvas.width = cameraFeed.videoWidth || 640;
        canvas.height = cameraFeed.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        
        // Convert to file
        canvas.toBlob((blob) => {
            const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
            stopCamera();
            cameraTab.style.display = 'none';
            simulateAnalysis(file);
        }, 'image/jpeg', 0.9);
    });

    fileUpload.addEventListener('change', handleFile);
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileUpload.files = e.dataTransfer.files;
            handleFile();
        }
    });

    function handleFile() {
        const file = fileUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                dropZone.style.display = 'none';
                previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    // NEW UPLOAD LOGIC
    analyzeBtn.addEventListener('click', () => {
        uploadTab.style.display = 'none';
        const file = fileUpload.files[0];
        simulateAnalysis(file);
    });

    function resetModal() {
        cameraTab.style.display = 'block';
        uploadTab.style.display = 'none';
        scanResult.style.display = 'none';
        
        dropZone.style.display = 'block';
        previewContainer.style.display = 'none';
        fileUpload.value = '';
        imagePreview.src = '';
        
        tabBtns[0].classList.add('active');
        tabBtns[1].classList.remove('active');
    }

    // Database Integration: Save Scan with REAL IMAGE
    function simulateAnalysis(file = null) {
        scanResult.style.display = 'block';
        scanResult.innerHTML = '<h3 class="text-center" style="color:var(--text-main)"><i class="fa-solid fa-spinner fa-spin" style="color:var(--primary)"></i> Processing Real Image & Running AI...</h3>';
        
        setTimeout(async () => {
            const isHealthy = Math.random() > 0.4;
            const confidence = isHealthy ? Math.floor(Math.random() * 10 + 90) : Math.floor(Math.random() * 15 + 75);
            const statusStr = isHealthy ? 'Healthy' : 'Early Blight';
            const sectorChar = String.fromCharCode(65 + Math.floor(Math.random()*6));
            
            scanResult.innerHTML = `
                <div class="text-center">
                    <i class="fa-solid fa-circle-check" style="color:var(--success); font-size:3rem; margin-bottom:1rem;"></i>
                    <h3 style="color:var(--text-main); margin-bottom: 0.5rem">Scan Complete</h3>
                    <p style="color:var(--text-muted); margin-bottom: 1rem">New Crop Sample - Sector ${sectorChar}</p>
                    <span class="badge ${isHealthy ? 'healthy' : 'danger'}" style="font-size: 1rem; padding: 0.5rem 1rem;">
                        ${isHealthy ? 'Healthy Plant' : 'Early Blight Detected (' + confidence + '%)'}
                    </span>
                </div>
            `;
            
            try {
                // Use FormData to send the image file along with the metadata
                const formData = new FormData();
                formData.append('crop_type', 'New Sample');
                formData.append('sector', sectorChar);
                formData.append('status', statusStr);
                formData.append('confidence', confidence);
                if (file) {
                    formData.append('image', file);
                }

                await fetch('/api/scans', {
                    method: 'POST',
                    body: formData
                });
                
                // Reload scans from DB to show the new image
                await loadScans();
                
                if (detectionChart) {
                    const currentData = detectionChart.data.datasets[0].data;
                    currentData.shift(); 
                    currentData.push(confidence); 
                    detectionChart.update();
                }
            } catch(e) {
                console.error('Save scan error:', e);
            }
            
            setTimeout(closeModal, 3000);
        }, 2000);
    }

    // Advanced Diagnostic Scanner Logic
    const advancedUpload = document.getElementById('advancedFileUpload');
    const advancedDropZone = document.getElementById('advancedDropZone');
    const advancedResult = document.getElementById('advancedResult');
    const advancedPreview = document.getElementById('advancedPreview');

    if(advancedUpload) {
        advancedUpload.addEventListener('change', handleAdvancedFile);
        advancedDropZone.addEventListener('dragover', (e) => { e.preventDefault(); advancedDropZone.classList.add('dragover'); });
        advancedDropZone.addEventListener('dragleave', () => advancedDropZone.classList.remove('dragover'));
        advancedDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            advancedDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                advancedUpload.files = e.dataTransfer.files;
                handleAdvancedFile();
            }
        });
    }

    function handleAdvancedFile() {
        const file = advancedUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                advancedPreview.src = e.target.result;
                advancedDropZone.innerHTML = '<h3 class="text-center" style="color:var(--text-main)"><i class="fa-solid fa-spinner fa-spin" style="color:var(--primary)"></i> Running Advanced AI Diagnostic...</h3>';
                setTimeout(() => {
                    advancedDropZone.style.display = 'none';
                    advancedResult.style.display = 'block';
                }, 2500);
            };
            reader.readAsDataURL(file);
        }
    }

    function initWaterChart() {
        const ctx = document.getElementById('waterChart');
        if(!ctx) return;
        waterChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Water Usage (Gallons)',
                    data: [1200, 1900, 800, 1500, 2200, 2500, 1800],
                    backgroundColor: 'rgba(56, 189, 248, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    function initYieldChart() {
        const ctx = document.getElementById('yieldChart');
        if(!ctx) return;
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0.5)'); 
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

        yieldChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                datasets: [
                    { label: 'Predicted Yield', data: [50, 65, 80, 110, 140, 180, 220, 250], borderColor: '#a855f7', backgroundColor: gradient, borderWidth: 3, fill: true, tension: 0.4 },
                    { label: 'Actual Yield (Last Year)', data: [45, 60, 75, 100, 120, 150, 190, 210], borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, fill: false, tension: 0.4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
});
