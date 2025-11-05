// Global data storage
let medicines = JSON.parse(localStorage.getItem('medicines')) || [];
let reminders = JSON.parse(localStorage.getItem('reminders')) || [];
let familyMembers = JSON.parse(localStorage.getItem('familyMembers')) || ['Self'];
let currentFilter = 'all';
let currentViewMode = 'list';
let currentEditingMedicineId = null;
let notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';

// Image handling variables
let medicineImageData = null;
let editMedicineImageData = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    updateAllDisplays();
    setupImageHandlers();
    setupNotificationListener();
});

function initializeApp() {
    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('darkModeToggle').checked = darkMode;
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
    
    // Load notification preference
    document.getElementById('notificationToggle').checked = notificationsEnabled;
    
    // Set default view mode
    setViewMode('list');

    // *** FIX: Run daily status reset on load ***
    checkAndResetReminderStatuses();
}

// *** FIX: New function to reset reminder statuses daily ***
function checkAndResetReminderStatuses() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('lastResetDate');
    
    if (lastReset !== today) {
        console.log('Resetting reminder statuses for a new day.');
        reminders.forEach(r => r.status = 'pending');
        saveData();
        localStorage.setItem('lastResetDate', today);
    }
}

// Notification Functions
function toggleNotifications() {
    notificationsEnabled = document.getElementById('notificationToggle').checked;
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
    
    if (notificationsEnabled) {
        requestNotificationPermission();
        alert('Notifications enabled! You will receive reminders for your medicines.');
    } else {
        alert('Notifications disabled.');
    }
}

function requestNotificationPermission() {
    if ("Notification" in window && notificationsEnabled) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Notification permission granted.");
            }
        });
    }
}

function showNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted" && notificationsEnabled) {
        new Notification(title, {
            body: body,
            icon: '/favicon.ico' // Note: This icon might not work unless you have one in your root
        });
    }
}

function setupNotificationListener() {
    // Check for due reminders every minute
    setInterval(() => {
        checkDueReminders();
    }, 60000);
}

function checkDueReminders() {
    const now = new Date();
    const currentTime = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    
    reminders.forEach(reminder => {
        // Check if it's the right time and the reminder hasn't been fired today
        if (reminder.enabled && reminder.time === currentTime && reminder.status !== 'notified') {
            const medicine = medicines.find(med => med.id === reminder.medicineId);
            if (medicine) {
                showNotification('MediTrack+ Reminder', `Time to take ${medicine.name} - ${medicine.dosage}`);
                // Mark as notified so it doesn't fire again (until status is reset)
                reminder.status = 'notified'; 
                saveData();
            }
        }
    });
}

// Image Handlers
function setupImageHandlers() {
    // Add medicine image handler
    const imageInput = document.getElementById('medicineImageInput');
    imageInput.addEventListener('change', function(event) {
        handleImageUpload(event, 'add');
    });

    // Edit medicine image handler
    const editImageInput = document.getElementById('editMedicineImageInput');
    editImageInput.addEventListener('change', function(event) {
        handleImageUpload(event, 'edit');
    });
}

function openImagePicker() {
    document.getElementById('medicineImageInput').click();
}

function openEditImagePicker() {
    document.getElementById('editMedicineImageInput').click();
}

function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (type === 'add') {
                medicineImageData = e.target.result;
                document.getElementById('medicineImagePreview').src = medicineImageData;
                document.getElementById('medicineImagePreview').style.display = 'block';
                document.querySelector('#imagePreviewContainer .upload-placeholder').style.display = 'none';
                document.querySelector('#imagePreviewContainer .change-image-btn').style.display = 'block';
            } else {
                editMedicineImageData = e.target.result;
                document.getElementById('editMedicineImagePreview').src = editMedicineImageData;
                document.getElementById('editMedicineImagePreview').style.display = 'block';
                document.querySelector('#editImagePreviewContainer .upload-placeholder').style.display = 'none';
                document.querySelector('#editImagePreviewContainer .change-image-btn').style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

// View Mode Toggle
function setViewMode(mode) {
    currentViewMode = mode;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // Select the button based on mode. 'grid' is child 1, 'list' is child 2.
    const buttonIndex = (mode === 'grid') ? 1 : 2;
    document.querySelector(`.view-toggle .view-btn:nth-child(${buttonIndex})`).classList.add('active');

    
    // Show/hide views
    if (mode === 'grid') {
        document.getElementById('medicineGrid').style.display = 'grid';
        document.getElementById('medicineList').style.display = 'none';
    } else {
        document.getElementById('medicineGrid').style.display = 'none';
        document.getElementById('medicineList').style.display = 'block';
    }
    
    updateMedicineList();
}

// Screen navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    }
    
    updateBottomNav(screenId);
    
    // *** FIX: Run daily reset and update dashboard reminders ***
    if (screenId === 'homeScreen') {
        checkAndResetReminderStatuses(); // Run reset when visiting home
        updateDashboard();
        updateTodayReminders(); // Update reminders list
    } else if (screenId === 'inventoryScreen') {
        updateMedicineList();
    } else if (screenId === 'remindersScreen') {
        updateRemindersList();
    } else if (screenId === 'settingsScreen') {
        updateFamilyMembersList();
    } else if (screenId === 'addMedicineScreen') {
        // Reset image when going to add medicine screen
        resetImageUpload();
        updateFamilyMembersDropdown(); // Ensure dropdown is populated
    }
}

function resetImageUpload() {
    medicineImageData = null;
    document.getElementById('medicineImagePreview').style.display = 'none';
    document.querySelector('#imagePreviewContainer .upload-placeholder').style.display = 'flex';
    document.querySelector('#imagePreviewContainer .change-image-btn').style.display = 'none';
    document.getElementById('medicineImageInput').value = '';
}

function updateBottomNav(screenId) {
    const screenToNavMap = {
        'homeScreen': 0,
        'inventoryScreen': 1,
        'remindersScreen': 2,
        'settingsScreen': 3
    };
    
    // Find all bottom navs (one per screen) and update them
    document.querySelectorAll('.bottom-nav').forEach(nav => {
        const items = nav.querySelectorAll('.nav-item');
        if (items.length > 0) {
            items.forEach(item => item.classList.remove('active'));
            if (screenToNavMap[screenId] !== undefined) {
                items[screenToNavMap[screenId]].classList.add('active');
            }
        }
    });
}

// Medicine Management
function addMedicine() {
    const name = document.getElementById('medicineName').value;
    const expiry = document.getElementById('expiryDate').value;
    const dosage = document.getElementById('dosage').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const person = document.getElementById('personSelect').value;
    
    if (!name || !expiry || !dosage || !quantity) {
        alert('Please fill in all required fields.');
        return;
    }
    
    const medicine = {
        id: Date.now(),
        name,
        expiry,
        dosage,
        quantity,
        person,
        image: medicineImageData, // This is correct
        addedDate: new Date().toISOString()
    };
    
    medicines.push(medicine);
    saveData();
    updateAllDisplays();
    
    // Clear form
    document.getElementById('medicineName').value = '';
    document.getElementById('expiryDate').value = '';
    document.getElementById('dosage').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('manualDateInput').style.display = 'none';
    document.getElementById('manualDate').value = '';
    document.getElementById('newFamilyMember').value = '';
    resetImageUpload();
    
    showScreen('homeScreen');
    alert('Medicine added successfully!');
}

function updateAllDisplays() {
    updateDashboard();
    updateMedicineList();
    updateFamilyMembersDropdown();
    updateTodayReminders();
    updateRemindersList();
}

function updateDashboard() {
    const activeMeds = medicines.length;
    
    // Calculate expiring soon (within 7 days)
    const expiringSoon = medicines.filter(med => {
        const expiryDate = new Date(med.expiry);
        const today = new Date();
        today.setHours(0,0,0,0); // Normalize today to start of day
        const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysDiff <= 7 && daysDiff >= 0; // >= 0 includes today
    }).length;
    
    // Calculate expired medicines
    const expired = medicines.filter(med => {
        const expiryDate = new Date(med.expiry);
        const today = new Date();
        today.setHours(0,0,0,0); // Normalize today to start of day
        return expiryDate < today;
    }).length;
    
    document.getElementById('activeMedsCount').textContent = activeMeds;
    document.getElementById('expiringSoonCount').textContent = expiringSoon;
    document.getElementById('expiredCount').textContent = expired;
    
    // Update card styles
    const expiringCard = document.getElementById('expiringSoonCard');
    const expiredCard = document.getElementById('expiredCard');
    
    if (expiringSoon > 0) {
        expiringCard.classList.add('expiring');
    } else {
        expiringCard.classList.remove('expiring');
    }
    
    if (expired > 0) {
        expiredCard.classList.add('warning');
    } else {
        expiredCard.classList.remove('warning');
    }
}

// *** FIX: Replaced entire function ***
function updateTodayReminders() {
    const todayRemindersList = document.getElementById('todayRemindersList');
    const now = new Date();

    // 1. Get reminders that apply today (only 'daily' is fully supported by this logic)
    const todayApplicableReminders = reminders.filter(reminder => {
        // In a real app, you'd check 'weekly', 'monthly' rules here
        return reminder.enabled && reminder.repeat === 'daily';
    }).sort((a, b) => a.time.localeCompare(b.time)); // Sort by time

    if (todayApplicableReminders.length === 0) {
        todayRemindersList.innerHTML = `
            <div class="empty-state">
                <p>No reminders for today</p>
                <button class="btn-secondary" onclick="showScreen('remindersScreen')">Add Reminder</button>
            </div>
        `;
    } else {
        todayRemindersList.innerHTML = todayApplicableReminders.map(reminder => {
            const medicine = medicines.find(med => med.id === reminder.medicineId);
            
            // Create a Date object for today at the reminder's time
            const [hours, minutes] = reminder.time.split(':');
            const reminderTimeToday = new Date();
            reminderTimeToday.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const timeString = reminderTimeToday.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });

            // Use the stored status, which is reset daily
            const statusClass = reminder.status === 'completed' ? 'completed' : 'pending';

            return `
                <div class="reminder-item" onclick="markReminderCompleted(${reminder.id})">
                    <div class="reminder-time">${timeString}</div>
                    <div class="reminder-details">
                        <h4>${medicine ? medicine.name : 'Unknown Medicine'}</h4>
                        <p>${reminder.dosage}</p>
                    </div>
                    <div class="reminder-status ${statusClass}"></div>
                </div>
            `;
        }).join('');
    }
}

// *** FIX: Corrected status toggling ***
function markReminderCompleted(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
        // Toggle the status
        reminder.status = (reminder.status === 'completed') ? 'pending' : 'completed';
        saveData();
        updateTodayReminders(); // Refresh the list
    }
}

function updateMedicineList() {
    const medicineList = document.getElementById('medicineList');
    const medicineGrid = document.getElementById('medicineGrid');
    let filteredMedicines = medicines;
    
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today

    switch (currentFilter) {
        case 'expiring':
            filteredMedicines = medicines.filter(med => {
                const expiryDate = new Date(med.expiry);
                const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7 && daysDiff >= 0;
            });
            break;
        case 'expired':
            filteredMedicines = medicines.filter(med => {
                const expiryDate = new Date(med.expiry);
                return expiryDate < today;
            });
            break;
        case 'low':
            filteredMedicines = medicines.filter(med => med.quantity <= 10);
            break;
    }
    
    if (filteredMedicines.length === 0) {
        const emptyHtml = `
            <div class="empty-state">
                <p>No medicines found</p>
                <button class="btn-secondary" onclick="showScreen('addMedicineScreen')">Add Medicine</button>
            </div>
        `;
        medicineList.innerHTML = emptyHtml;
        medicineGrid.innerHTML = emptyHtml; // Use same empty state for grid
    } else {
        // Update List View
        medicineList.innerHTML = filteredMedicines.map(medicine => {
            const expiryDate = new Date(medicine.expiry);
            const isExpired = expiryDate < today;
            
            const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysDiff <= 7 && daysDiff >= 0;
            
            const cardClass = isExpired ? 'warning' : (isExpiringSoon ? 'expiring' : '');
            const statusIcon = isExpired ? '⚠️' : (isExpiringSoon ? '🕒' : '✅');
            
            return `
                <div class="medicine-card ${cardClass}">
                    ${medicine.image ? 
                        `<img src="${medicine.image}" alt="${medicine.name}" class="medicine-image-list">` :
                        `<div class="medicine-icon">💊</div>`
                    }
                    <div class="medicine-info">
                        <h3>${medicine.name}</h3>
                        <p>Expires: ${formatDate(medicine.expiry)}</p>
                        <p>Quantity: ${medicine.quantity} | For: ${medicine.person}</p>
                        <p>Dosage: ${medicine.dosage}</p>
                        <div class="medicine-actions">
                            <button class="btn-small btn-edit" onclick="editMedicine(${medicine.id})">Edit</button>
                            <button class="btn-small btn-delete" onclick="deleteMedicine(${medicine.id})">Delete</button>
                        </div>
                    </div>
                    <div class="medicine-status ${cardClass}">
                        ${statusIcon}
                    </div>
                </div>
            `;
        }).join('');

        // Update Grid View
        medicineGrid.innerHTML = filteredMedicines.map(medicine => {
            const expiryDate = new Date(medicine.expiry);
            const isExpired = expiryDate < today;

            const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysDiff <= 7 && daysDiff >= 0;
            
            const cardClass = isExpired ? 'warning' : (isExpiringSoon ? 'expiring' : '');
            
            return `
                <div class="medicine-card-grid ${cardClass}">
                    ${medicine.image ? 
                        `<img src="${medicine.image}" alt="${medicine.name}" class="medicine-image-grid">` :
                        `<div class="medicine-icon" style="font-size: 3rem; margin-bottom: 8px;">💊</div>`
                    }
                    <div class="medicine-info-grid">
                        <h4>${medicine.name}</h4>
                        <p>Exp: ${formatDate(medicine.expiry)}</p>
                        <p>Qty: ${medicine.quantity}</p>
                        <p>${medicine.dosage}</p>
                        <div class="medicine-actions">
                            <button class="btn-small btn-edit" onclick="editMedicine(${medicine.id})">Edit</button>
                            <button class="btn-small btn-delete" onclick="deleteMedicine(${medicine.id})">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Edit Medicine Functionality
function editMedicine(medicineId) {
    const medicine = medicines.find(med => med.id === medicineId);
    if (!medicine) return;

    currentEditingMedicineId = medicineId;
    
    // Populate edit form
    document.getElementById('editMedicineName').value = medicine.name;
    document.getElementById('editExpiryDate').value = medicine.expiry;
    document.getElementById('editDosage').value = medicine.dosage;
    document.getElementById('editQuantity').value = medicine.quantity;
    
    // Update family members dropdown
    const editPersonSelect = document.getElementById('editPersonSelect');
    editPersonSelect.innerHTML = familyMembers.map(member => 
        `<option value="${member}" ${medicine.person === member ? 'selected' : ''}>${member}</option>`
    ).join('');
    
    // Handle image
    // This is the variable that will be saved
    editMedicineImageData = medicine.image; 

    if (medicine.image) {
        document.getElementById('editMedicineImagePreview').src = medicine.image;
        document.getElementById('editMedicineImagePreview').style.display = 'block';
        document.querySelector('#editImagePreviewContainer .upload-placeholder').style.display = 'none';
        document.querySelector('#editImagePreviewContainer .change-image-btn').style.display = 'block';
    } else {
        document.getElementById('editMedicineImagePreview').style.display = 'none';
        document.querySelector('#editImagePreviewContainer .upload-placeholder').style.display = 'flex';
        document.querySelector('#editImagePreviewContainer .change-image-btn').style.display = 'none';
    }
    
    // Show modal
    document.getElementById('editMedicineModal').classList.add('active');
}

function saveEditedMedicine() {
    const medicineIndex = medicines.findIndex(med => med.id === currentEditingMedicineId);
    if (medicineIndex === -1) return;

    const name = document.getElementById('editMedicineName').value;
    const expiry = document.getElementById('editExpiryDate').value;
    const dosage = document.getElementById('editDosage').value;
    const quantity = parseInt(document.getElementById('editQuantity').value);
    const person = document.getElementById('editPersonSelect').value;

    if (!name || !expiry || !dosage || !quantity) {
        alert('Please fill in all required fields.');
        return;
    }

    // Update medicine
    medicines[medicineIndex] = {
        ...medicines[medicineIndex],
        name,
        expiry,
        dosage,
        quantity,
        person,
        // *** FIX: Simplified image save logic ***
        image: editMedicineImageData 
    };

    saveData();
    updateAllDisplays();
    closeModal('editMedicineModal');
    alert('Medicine updated successfully!');
}

function filterMedicines(filter) {
    currentFilter = filter;
    
    // Update active tab visuals
    document.querySelectorAll('.filter-tab').forEach(tab => {
        if (tab.getAttribute('onclick').includes(`'${filter}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    updateMedicineList();
}

function formatDate(dateString) {
    // Handles 'YYYY-MM-DD' input from <input type="date">
    const date = new Date(dateString + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function deleteMedicine(medicineId) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        medicines = medicines.filter(med => med.id !== medicineId);
        // Also remove any reminders for this medicine
        reminders = reminders.filter(reminder => reminder.medicineId !== medicineId);
        saveData();
        updateAllDisplays();
    }
}

// Family Members Management
function addFamilyMember() {
    const nameInput = document.getElementById('newFamilyMember');
    const name = nameInput.value.trim();
    
    if (name && !familyMembers.includes(name)) {
        familyMembers.push(name);
        saveData();
        updateFamilyMembersDropdown();
        nameInput.value = '';
        alert('Family member added!');
    } else if (familyMembers.includes(name)) {
        alert('Family member already exists!');
    }
}

function updateFamilyMembersDropdown() {
    const selects = document.querySelectorAll('#personSelect, #editPersonSelect');
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = familyMembers.map(member => 
            `<option value="${member}">${member}</option>`
        ).join('');
        select.value = currentVal; // Preserve selection if possible
    });
}

function updateFamilyMembersList() {
    const list = document.getElementById('familyMembersList');
    if (familyMembers.length <= 1) { // Only "Self"
        list.innerHTML = '<p class="empty-text">No members yet. Add family members when adding medicines.</p>';
    } else {
        list.innerHTML = familyMembers.filter(member => member !== 'Self').map(member => `
            <div class="family-member-item">
                <span class="family-member-name">${member}</span>
                <button class="btn-small btn-delete" onclick="removeFamilyMember('${member}')">Remove</button>
            </div>
        `).join('');
    }
}

function removeFamilyMember(member) {
    if (confirm(`Remove ${member} from family members?`)) {
        familyMembers = familyMembers.filter(m => m !== member);
        saveData();
        updateFamilyMembersList();
        updateFamilyMembersDropdown();
    }
}

// Reminders Management
function addNewReminder() {
    const modal = document.getElementById('addReminderModal');
    const medicineSelect = document.getElementById('reminderMedicine');
    
    // Populate medicine dropdown
    medicineSelect.innerHTML = '<option value="">Select Medicine</option>' +
        medicines.map(med => `<option value="${med.id}">${med.name}</option>`).join('');
    
    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function saveReminder() {
    const medicineId = parseInt(document.getElementById('reminderMedicine').value);
    const time = document.getElementById('reminderTime').value;
    const repeat = document.getElementById('reminderRepeat').value;
    
    if (!medicineId || !time) {
        alert('Please select a medicine and time.');
        return;
    }
    
    const medicine = medicines.find(med => med.id === medicineId);
    const reminder = {
        id: Date.now(),
        medicineId,
        medicineName: medicine.name,
        dosage: medicine.dosage, // Get dosage from medicine
        time,
        repeat,
        enabled: true,
        status: 'pending', // Default status
        nextAlert: calculateNextAlert(time) // Still useful for notifications
    };
    
    reminders.push(reminder);
    saveData();
    updateRemindersList();
    updateTodayReminders();
    closeModal('addReminderModal');
    alert('Reminder added successfully!');
}

function calculateNextAlert(time) {
    const today = new Date();
    const [hours, minutes] = time.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (today < new Date()) {
        today.setDate(today.getDate() + 1);
    }
    
    return today.toISOString();
}

function updateRemindersList() {
    const reminderSchedule = document.getElementById('reminderSchedule');
    
    if (reminders.length === 0) {
        reminderSchedule.innerHTML = `
            <div class="empty-state">
                <p>No reminders set</p>
                <button class="btn-secondary" onclick="addNewReminder()">Add Reminder</button>
            </div>
        `;
    } else {
        reminderSchedule.innerHTML = reminders.sort((a, b) => a.time.localeCompare(b.time)).map(reminder => {
            const medicine = medicines.find(med => med.id === reminder.medicineId);
            
            const [hours, minutes] = reminder.time.split(':');
            const reminderTime = new Date();
            reminderTime.setHours(parseInt(hours), parseInt(minutes));
            const timeString = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            return `
                <div class="time-slot">
                    <div class="time-marker">${timeString}</div>
                    <div class="reminder-pill">
                        <span>${medicine ? medicine.name : 'Unknown Medicine'} - ${reminder.dosage}</span>
                        <div class="reminder-item-actions">
                            <button class="toggle-btn ${reminder.enabled ? 'active' : ''}" 
                                    onclick="toggleReminder(${reminder.id})">
                                ${reminder.enabled ? 'ON' : 'OFF'}
                            </button>
                            <button class="btn-small btn-delete" onclick="deleteReminder(${reminder.id})">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function toggleReminder(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    reminder.enabled = !reminder.enabled;
    saveData();
    updateRemindersList();
    updateTodayReminders();
}

function deleteReminder(reminderId) {
    if (confirm('Delete this reminder?')) {
        reminders = reminders.filter(r => r.id !== reminderId);
        saveData();
        updateRemindersList();
        updateTodayReminders();
    }
}

// Export Functions
function exportMedicineLogs() {
    const data = {
        medicines: medicines,
        exportDate: new Date().toISOString(),
        summary: {
            totalMedicines: medicines.length,
            expiringSoon: medicines.filter(med => {
                const expiryDate = new Date(med.expiry);
                const today = new Date();
                const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7 && daysDiff > 0;
            }).length,
            expired: medicines.filter(med => {
                const expiryDate = new Date(med.expiry);
                const today = new Date();
                return expiryDate < today;
            }).length
        }
    };
    
    exportToFile(data, 'medicine-logs');
}

function exportReminders() {
    const data = {
        reminders: reminders,
        exportDate: new Date().toISOString(),
        summary: {
            totalReminders: reminders.length,
            activeReminders: reminders.filter(r => r.enabled).length
        }
    };
    
    exportToFile(data, 'reminders');
}

function exportAllData() {
    const data = {
        medicines: medicines,
        reminders: reminders,
        familyMembers: familyMembers,
        exportDate: new Date().toISOString(),
        settings: {
            notificationsEnabled: notificationsEnabled,
            darkMode: document.body.classList.contains('dark-mode')
        }
    };
    
    exportToFile(data, 'meditrack-full-backup');
}

function exportToFile(data, filename) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    alert('Data exported successfully!');
}

// Settings Functions
function toggleDarkMode() {
    const isDarkMode = document.getElementById('darkModeToggle').checked;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
}

// Filter Menu
function showFilterMenu() {
    // Simple filter implementation
    const filters = ['all', 'expiring', 'expired', 'low'];
    
    let filterText = prompt(`Enter filter (case insensitive):\n- All\n- Expiring\n- Expired\n- Low`);
    
    if (filterText) {
        filterText = filterText.trim().toLowerCase();
        if (filters.includes(filterText)) {
            // Manually find the corresponding tab button to click
            const tabButtons = document.querySelectorAll('#inventoryScreen .filter-tab');
            const matchingButton = Array.from(tabButtons).find(btn => btn.textContent.toLowerCase().includes(filterText));
            if (matchingButton) {
                matchingButton.click();
            }
        } else {
            alert('Invalid filter. Please choose from: All, Expiring, Expired, Low.');
        }
    }
}

// Data persistence
function saveData() {
    localStorage.setItem('medicines', JSON.stringify(medicines));
    localStorage.setItem('reminders', JSON.stringify(reminders));
    localStorage.setItem('familyMembers', JSON.stringify(familyMembers));
}

// OCR Functionality - SIMPLIFIED VERSION
function openCameraForOCR() {
    // Show manual input option immediately
    document.getElementById('manualDateInput').style.display = 'block';
    
    // Create camera input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            // Show loading state
            showOCRLoading();
            
            // Simulate OCR processing with timeout
            setTimeout(() => {
                simulateOCRProcessing(file);
            }, 2000);
        }
    };
    
    input.click();
}

function showOCRLoading() {
    // Remove existing scanner container if any
    const existingScanner = document.querySelector('.scanner-container');
    if (existingScanner) {
        existingScanner.remove();
    }

    // Create loading scanner UI
    const scannerContainer = document.createElement('div');
    scannerContainer.className = 'scanner-container';
    scannerContainer.style.textAlign = 'center';
    scannerContainer.style.marginTop = '20px';
    scannerContainer.innerHTML = `
        <div class="scanner-placeholder" style="padding: 20px; border: 2px dashed #cbd5e0; border-radius: 12px; background: #f7fafc;">
            <div class="scanner-icon" style="font-size: 2rem;">🔍</div>
            <p>Processing image with OCR...</p>
            <div class="loading" style="margin: 10px auto;"></div>
            <p><small>Analyzing text for expiry date...</small></p>
        </div>
    `;
    
    document.querySelector('#addMedicineScreen .form-container').after(scannerContainer);
}

function simulateOCRProcessing(file) {
    // Create a URL for the image
    const imageUrl = URL.createObjectURL(file);
    
    // Common mock expiry dates for simulation
    const mockDates = [
        '2024-12-31', '2025-06-15', '2024-08-20', 
        '2025-03-10', '2024-11-30'
    ];
    
    // Randomly pick a mock date
    const randomDate = mockDates[Math.floor(Math.random() * mockDates.length)];
    
    // Update the scanner container with mock results
    const scannerContainer = document.querySelector('.scanner-container');
    scannerContainer.innerHTML = `
        <div class="image-preview" style="margin-bottom: 15px;">
            <img src="${imageUrl}" alt="Captured medicine" style="max-width: 200px; border-radius: 10px; border: 2px solid #e2e8f0;">
        </div>
        <div class="ocr-result" style="background: #e6ffed; padding: 15px; border-radius: 10px;">
            <h4>✅ Expiry Date Detected!</h4>
            <p><strong>Detected: ${formatDisplayDate(randomDate)}</strong></p>
            <p><small>This is a simulation. In a real app, OCR would analyze the actual image text.</small></p>
            <button class="btn-primary" onclick="useDetectedDate('${randomDate}')" style="margin-top: 10px;">Use This Date</button>
        </div>
        <button class="btn-secondary" onclick="retryOCR()" style="margin-top: 10px;">Scan Another Image</button>
    `;
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function useDetectedDate(dateString) {
    document.getElementById('expiryDate').value = dateString;
    // Remove the scanner container
    const scannerContainer = document.querySelector('.scanner-container');
    if (scannerContainer) {
        scannerContainer.remove();
    }
    // Hide manual input
    document.getElementById('manualDateInput').style.display = 'none';
    alert('Expiry date filled automatically!');
}

function retryOCR() {
    const scannerContainer = document.querySelector('.scanner-container');
    if (scannerContainer) {
        scannerContainer.remove();
    }
    openCameraForOCR();
}

// Manual Date Parser
function parseManualDate() {
    const manualDate = document.getElementById('manualDate').value;
    const parsedDate = extractDateFromText(manualDate);
    
    if (parsedDate) {
        document.getElementById('expiryDate').value = parsedDate;
        alert('Date parsed successfully!');
    } else {
        alert('Could not parse date. Please use formats like: DD/MM/YYYY or MM/DD/YYYY');
    }
}

function extractDateFromText(text) {
    // Simple date pattern matching
    const patterns = [
        // DD/MM/YYYY or MM/DD/YYYY (handles 1 or 2 digits)
        /(?<day>\d{1,2})[\/\-\.](?<month>\d{1,2})[\/\-\.](?<year>\d{2,4})/, 
        // YYYY/MM/DD
        /(?<year>\d{4})[\/\-\.](?<month>\d{1,2})[\/\-\.](?<day>\d{1,2})/,
    ];

    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match && match.groups) {
            let { day, month, year } = match.groups;
            
            // Ensure 4-digit year
            if (year.length === 2) {
                year = '20' + year;
            }

            // Ambiguity check: If DD/MM format and both are <= 12, we guess.
            // For simplicity, this app assumes YYYY-MM-DD for the final format.
            // We must guess if it's MM/DD or DD/MM. Let's assume DD/MM first
            
            let d = parseInt(day);
            let m = parseInt(month);
            let y = parseInt(year);

            // Try parsing as DD/MM/YYYY (UK/Intl)
            let testDate = new Date(y, m - 1, d);
            if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
                // This is a valid date.
            } else {
                // Try swapping to MM/DD/YYYY (US)
                testDate = new Date(y, d - 1, m);
                if (testDate.getFullYear() === y && testDate.getMonth() === d - 1 && testDate.getDate() === m) {
                    // This is also valid, swap them
                    [day, month] = [month, day];
                } else {
                    // Invalid date
                    continue;
                }
            }

            // Pad month and day with leading zeros
            month = month.padStart(2, '0');
            day = day.padStart(2, '0');
            
            const formattedDate = `${year}-${month}-${day}`;
            
            // Final validation
            const date = new Date(formattedDate);
            if (!isNaN(date.getTime())) {
                return formattedDate;
            }
        }
    }
    
    return null;
}
