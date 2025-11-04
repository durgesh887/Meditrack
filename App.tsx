import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Medicine, Screen, FilterType, Reminder, FamilyMember } from './types';
import { extractMedicineDetailsFromImage } from './services/geminiService';
import {
  PillIcon, ClockIcon, UsersIcon, HomeIcon, PackageSearchIcon, BellIcon, SettingsIcon,
  PlusIcon, CameraIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, SunIcon,
  MoonIcon, ChevronLeftIcon
} from './components/Icons';

// --- Custom Hook for localStorage ---
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}


// --- App Component ---
const App: React.FC = () => {
  const [screen, setScreen] = useLocalStorage<Screen>('mediTrackScreen', Screen.Welcome);
  const [medicines, setMedicines] = useLocalStorage<Medicine[]>('mediTrackMedicines', []);
  const [family, setFamily] = useLocalStorage<FamilyMember[]>('mediTrackFamily', []);
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('mediTrackDarkMode', false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const addMedicine = (med: Omit<Medicine, 'id' | 'reminders'>) => {
    const newMed: Medicine = {
      ...med,
      id: new Date().toISOString(),
      reminders: []
    };
    setMedicines(prev => [...prev, newMed]);
  };

  const deleteMedicine = (id: string) => {
    setMedicines(prev => prev.filter(med => med.id !== id));
  }
  
  const updateMedicine = (updatedMed: Medicine) => {
    setMedicines(prev => prev.map(med => med.id === updatedMed.id ? updatedMed : med));
  }

  const renderScreen = () => {
    if (screen === Screen.Welcome) {
      return <WelcomeScreen onGetStarted={() => setScreen(Screen.Home)} />;
    }
    
    // For all other screens, wrap with Layout
    return (
      <Layout currentScreen={screen} setScreen={setScreen}>
        {screen === Screen.Home && <HomeScreen medicines={medicines} setScreen={setScreen} />}
        {screen === Screen.Inventory && <InventoryScreen medicines={medicines} deleteMedicine={deleteMedicine} />}
        {screen === Screen.AddMedicine && <AddMedicineScreen addMedicine={addMedicine} family={family} setFamily={setFamily} setScreen={setScreen} />}
        {screen === Screen.Reminders && <RemindersScreen medicines={medicines} updateMedicine={updateMedicine}/>}
        {screen === Screen.Settings && <SettingsScreen isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} family={family} setFamily={setFamily} />}
      </Layout>
    );
  };

  return (
    <div className="bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans">
      {renderScreen()}
    </div>
  );
};

// --- Screen Components ---

const WelcomeScreen: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
  return (
    <div className="flex flex-col h-screen justify-center items-center p-8 bg-gradient-to-br from-primary-light to-secondary-light dark:from-primary-dark dark:to-secondary-dark text-white">
      <div className="text-center">
        <PillIcon className="w-24 h-24 mx-auto text-white drop-shadow-lg" />
        <h1 className="text-4xl font-bold mt-6">MediTrack+</h1>
        <p className="text-lg mt-2 opacity-90">Your family's health, simplified.</p>
      </div>
      <div className="mt-16 text-center space-y-8">
        <div className="flex items-center space-x-4">
          <ClockIcon className="w-8 h-8 flex-shrink-0" />
          <p>Never miss a dose with smart reminders.</p>
        </div>
        <div className="flex items-center space-x-4">
          <AlertTriangleIcon className="w-8 h-8 flex-shrink-0" />
          <p>Track expiry dates and avoid unsafe medicines.</p>
        </div>
        <div className="flex items-center space-x-4">
          <UsersIcon className="w-8 h-8 flex-shrink-0" />
          <p>Manage medicines for yourself and your family.</p>
        </div>
      </div>
      <div className="mt-auto w-full">
        <button onClick={onGetStarted} className="w-full bg-white text-primary-dark font-bold py-4 px-8 rounded-full shadow-lg transform hover:scale-105 transition-transform">
          Get Started
        </button>
      </div>
    </div>
  );
};

const HomeScreen: React.FC<{ medicines: Medicine[]; setScreen: (screen: Screen) => void; }> = ({ medicines, setScreen }) => {
    const expiringSoon = useMemo(() => medicines.filter(m => {
        const diff = new Date(m.expiryDate).getTime() - new Date().getTime();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length, [medicines]);

    const lowQuantity = useMemo(() => medicines.filter(m => m.quantity <= 10).length, [medicines]);
    
    const todaysReminders = useMemo(() => {
        const now = new Date();
        const todayStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        return medicines.flatMap(med =>
            med.reminders
                .filter(r => r.enabled)
                .map(r => ({ ...med, reminderTime: r.time }))
        ).filter(r => r.reminderTime > todayStr)
        .sort((a, b) => a.reminderTime.localeCompare(b.reminderTime))
        .slice(0, 3);
    }, [medicines]);


    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Hello!</h1>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
                    <PackageSearchIcon className="w-6 h-6 text-secondary-dark" />
                    <p className="text-3xl font-bold mt-2">{medicines.length}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Medicines</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
                    <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />
                    <p className="text-3xl font-bold mt-2">{expiringSoon}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Expiring Soon</p>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
                    <PillIcon className="w-6 h-6 text-red-500" />
                    <p className="text-3xl font-bold mt-2">{lowQuantity}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Low Quantity</p>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-3">Today's Reminders</h2>
                <div className="space-y-3">
                    {todaysReminders.length > 0 ? (
                        todaysReminders.map(med => (
                            <div key={`${med.id}-${med.reminderTime}`} className="bg-white dark:bg-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-semibold">{med.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{med.dosage}</p>
                                </div>
                                <div className="flex items-center space-x-2 bg-primary-light/20 text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light px-3 py-1 rounded-full">
                                    <ClockIcon className="w-4 h-4" />
                                    <span className="font-medium text-sm">{med.reminderTime}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl">
                            <p className="text-gray-500 dark:text-gray-400">No more reminders for today!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const InventoryScreen: React.FC<{ medicines: Medicine[], deleteMedicine: (id: string) => void }> = ({ medicines, deleteMedicine }) => {
    const [filter, setFilter] = useState<FilterType>('all');
    
    const filteredMedicines = useMemo(() => {
        const now = new Date();
        switch (filter) {
            case 'expiring':
                return medicines.filter(m => {
                    const diff = new Date(m.expiryDate).getTime() - now.getTime();
                    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
                });
            case 'low':
                return medicines.filter(m => m.quantity <= 10);
            case 'unverified':
                return medicines.filter(m => !m.isVerified);
            default:
                return medicines;
        }
    }, [medicines, filter]);
    
    const getExpiryStatus = (expiryDate: string) => {
        const now = new Date();
        now.setHours(0,0,0,0);
        const expiry = new Date(expiryDate);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays < 0) return <span className="text-red-500 font-medium">Expired</span>;
        if (diffDays <= 30) return <span className="text-yellow-500 font-medium">{diffDays} days left</span>;
        return <span className="text-gray-500 dark:text-gray-400">{expiryDate}</span>;
    };

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-4">Inventory</h1>
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
                {(['all', 'expiring', 'low', 'unverified'] as FilterType[]).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${filter === f ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>
            <div className="space-y-3">
                {filteredMedicines.length > 0 ? filteredMedicines.map(med => (
                     <div key={med.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold">{med.name}</p>
                                {!med.isVerified && <AlertTriangleIcon title="Unverified" className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{med.dosage} &bull; Qty: {med.quantity}</p>
                            <p className="text-sm mt-1">{getExpiryStatus(med.expiryDate)}</p>
                        </div>
                        <button onClick={() => deleteMedicine(med.id)} className="text-red-500 hover:text-red-700 p-1">
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </div>
                )) : <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No medicines found for this filter.</p>}
            </div>
        </div>
    );
};

const AddMedicineScreen: React.FC<{
  addMedicine: (med: Omit<Medicine, 'id' | 'reminders'>) => void;
  family: FamilyMember[];
  setFamily: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  setScreen: (screen: Screen) => void;
}> = ({ addMedicine, family, setFamily, setScreen }) => {
  const [name, setName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [dosage, setDosage] = useState('');
  const [quantity, setQuantity] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isVerified, setIsVerified] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsScanning(true);
      setScanError(null);
      try {
        const details = await extractMedicineDetailsFromImage(file);
        if (details.name) {
          setName(details.name);
        }
        if (details.expiryDate) {
          setExpiryDate(details.expiryDate);
        }
        if (!details.name && !details.expiryDate) {
          setScanError("Could not automatically detect medicine details.");
        } else if (!details.name) {
          setScanError("Expiry date found, but name could not be detected.");
        } else if (!details.expiryDate) {
          setScanError("Name found, but expiry date could not be detected.");
        }
      } catch (error) {
        setScanError("An error occurred during scanning.");
        console.error(error);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && expiryDate && dosage && quantity && assignedTo) {
      const trimmedName = assignedTo.trim();
      const memberExists = family.some(member => member.name.toLowerCase() === trimmedName.toLowerCase());

      if (!memberExists && trimmedName) {
        const newMember: FamilyMember = {
          id: Date.now().toString(),
          name: trimmedName,
        };
        setFamily(prev => [...prev, newMember]);
      }

      addMedicine({
        name,
        expiryDate,
        dosage,
        quantity: parseInt(quantity),
        assignedTo: trimmedName,
        isVerified,
      });
      setScreen(Screen.Inventory);
    }
  };
  
  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
        <button onClick={() => setScreen(Screen.Home)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold ml-2">Add Medicine</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Medicine Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary" />
        </div>

        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
            <div className="flex items-center gap-2 mt-1">
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required className="w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary" />
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <button type="button" onClick={handleScanClick} disabled={isScanning} className="p-3 bg-secondary rounded-lg text-white disabled:opacity-50">
                    {isScanning ? <ClockIcon className="animate-spin w-6 h-6"/> : <CameraIcon className="w-6 h-6"/>}
                </button>
            </div>
            {scanError && <p className="text-red-500 text-sm mt-1">{scanError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium">Dosage</label>
                <input type="text" placeholder="e.g., 1 tablet" value={dosage} onChange={e => setDosage(e.target.value)} required className="mt-1 w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary" />
            </div>
            <div>
                <label className="text-sm font-medium">Quantity</label>
                <input type="number" placeholder="e.g., 30" value={quantity} onChange={e => setQuantity(e.target.value)} required className="mt-1 w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary" />
            </div>
        </div>
        
        <div>
            <label className="text-sm font-medium">For</label>
            <input 
              type="text" 
              list="family-members"
              placeholder="e.g., Jane Doe"
              value={assignedTo} 
              onChange={e => setAssignedTo(e.target.value)} 
              required 
              className="mt-1 w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary" />
             <datalist id="family-members">
              {family.map(member => <option key={member.id} value={member.name} />)}
            </datalist>
        </div>
        
        <div className="flex items-center">
            <input type="checkbox" checked={!isVerified} onChange={e => setIsVerified(!e.target.checked)} id="unverified" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
            <label htmlFor="unverified" className="ml-2 block text-sm">Expiry partially visible? Mark as Unverified.</label>
        </div>
        
        <button type="submit" className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
          Add Medicine
        </button>
      </form>
    </div>
  );
};

const RemindersScreen: React.FC<{medicines: Medicine[], updateMedicine: (med: Medicine) => void}> = ({medicines, updateMedicine}) => {

    const addReminder = (medId: string) => {
        const med = medicines.find(m => m.id === medId);
        if(!med) return;

        const newReminder: Reminder = { id: Date.now().toString(), time: '09:00', enabled: true };
        const updatedMed = { ...med, reminders: [...med.reminders, newReminder] };
        updateMedicine(updatedMed);
    }
    
    const updateReminder = (medId: string, reminderId: string, newTime: string, newEnabled: boolean) => {
        const med = medicines.find(m => m.id === medId);
        if(!med) return;
        
        const updatedReminders = med.reminders.map(r => r.id === reminderId ? { ...r, time: newTime, enabled: newEnabled } : r);
        updateMedicine({ ...med, reminders: updatedReminders });
    }

    const deleteReminder = (medId: string, reminderId: string) => {
        const med = medicines.find(m => m.id === medId);
        if(!med) return;
        
        const updatedReminders = med.reminders.filter(r => r.id !== reminderId);
        updateMedicine({ ...med, reminders: updatedReminders });
    }

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-4">Reminders</h1>
            <div className="space-y-4">
            {medicines.map(med => (
                <div key={med.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-lg">{med.name}</h2>
                    <div className="space-y-2 mt-2">
                        {med.reminders.map(reminder => (
                            <div key={reminder.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <input type="time" value={reminder.time} onChange={(e) => updateReminder(med.id, reminder.id, e.target.value, reminder.enabled)} className="bg-transparent border-none focus:ring-0" />
                                <div className="flex items-center gap-2">
                                    <button onClick={() => deleteReminder(med.id, reminder.id)}><XCircleIcon className="w-5 h-5 text-red-400"/></button>
                                    <label htmlFor={`toggle-${reminder.id}`} className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" id={`toggle-${reminder.id}`} className="sr-only" checked={reminder.enabled} onChange={(e) => updateReminder(med.id, reminder.id, reminder.time, e.target.checked)} />
                                            <div className={`block w-10 h-6 rounded-full ${reminder.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${reminder.enabled ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                         <button onClick={() => addReminder(med.id)} className="w-full text-sm font-semibold text-primary dark:text-primary-light py-2 rounded-lg hover:bg-primary/10 transition-colors">
                            + Add Reminder
                        </button>
                    </div>
                </div>
            ))}
            {medicines.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 mt-8">Add a medicine to set reminders.</p>}
            </div>
        </div>
    )
};

const SettingsScreen: React.FC<{
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean | ((val: boolean) => boolean)) => void;
  family: FamilyMember[];
  setFamily: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
}> = ({ isDarkMode, setIsDarkMode, family, setFamily }) => {
    
    const [newMemberName, setNewMemberName] = useState('');
    
    const addMember = () => {
        if (newMemberName.trim()) {
            const memberExists = family.some(member => member.name.toLowerCase() === newMemberName.trim().toLowerCase());
            if(!memberExists) {
                setFamily(prev => [...prev, { id: Date.now().toString(), name: newMemberName.trim() }]);
                setNewMemberName('');
            }
        }
    };
    
    const deleteMember = (id: string) => {
        setFamily(prev => prev.filter(member => member.id !== id));
    };

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <h2 className="font-semibold mb-2">Appearance</h2>
                <div className="flex justify-between items-center">
                    <p>Dark Mode</p>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700">
                        {isDarkMode ? <SunIcon className="w-5 h-5 text-yellow-400" /> : <MoonIcon className="w-5 h-5 text-gray-600" />}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <h2 className="font-semibold mb-2">Family Members</h2>
                <div className="space-y-2">
                    {family.map(member => (
                        <div key={member.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                           <p>{member.name}</p>
                           <button onClick={() => deleteMember(member.id)} className="text-red-500 hover:text-red-700">
                               <XCircleIcon className="w-5 h-5" />
                           </button>
                        </div>
                    ))}
                    {family.length === 0 && (
                        <p className="text-center text-gray-500 dark:text-gray-400 pt-2">
                            No members yet. Assign a medicine to a new person to add them here.
                        </p>
                    )}
                </div>
                <div className="flex gap-2 mt-4">
                    <input 
                        type="text" 
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="New member name"
                        className="flex-grow p-2 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-primary focus:border-primary"
                    />
                    <button onClick={addMember} className="px-4 bg-primary text-white font-semibold rounded-lg">Add</button>
                </div>
            </div>

             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <h2 className="font-semibold mb-2">Data</h2>
                <button className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Export Medicine Logs</button>
                <button className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Backup to Cloud</button>
            </div>
        </div>
    );
};


// --- Layout and Navigation Components ---

const Layout: React.FC<{ children: React.ReactNode; currentScreen: Screen; setScreen: (screen: Screen) => void; }> = ({ children, currentScreen, setScreen }) => {
  const showFab = currentScreen === Screen.Home || currentScreen === Screen.Inventory;
  
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-grow overflow-y-auto pb-24">
        {children}
      </main>
      { showFab &&
        <button
          onClick={() => setScreen(Screen.AddMedicine)}
          className="fixed bottom-24 right-6 bg-gradient-to-br from-primary to-secondary-dark text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform"
        >
          <PlusIcon className="w-8 h-8" />
        </button>
      }
      <BottomNav currentScreen={currentScreen} setScreen={setScreen} />
    </div>
  );
};

const BottomNav: React.FC<{ currentScreen: Screen; setScreen: (screen: Screen) => void; }> = ({ currentScreen, setScreen }) => {
  const navItems = [
    { screen: Screen.Home, icon: HomeIcon, label: 'Home' },
    { screen: Screen.Inventory, icon: PackageSearchIcon, label: 'Inventory' },
    { screen: Screen.Reminders, icon: BellIcon, label: 'Reminders' },
    { screen: Screen.Settings, icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-around max-w-md mx-auto p-2">
        {navItems.map(item => (
          <button
            key={item.label}
            onClick={() => setScreen(item.screen)}
            className={`flex flex-col items-center justify-center w-1/4 p-2 rounded-lg transition-colors ${currentScreen === item.screen ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default App;