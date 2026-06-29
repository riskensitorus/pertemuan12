import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Alert, 
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = '@todo_list_data';
const STATS_KEY = '@todo_list_stats';
const PIN_KEY = 'APP_PIN'; // Menggunakan key sesuai instruksi baru

export default function App() {
  const [task, setTask] = useState('');
  const [taskList, setTaskList] = useState([]);
  const [search, setSearch] = useState('');
  
  // State untuk Level 2: Statistik
  const [stats, setStats] = useState({ totalCreated: 0, totalCompleted: 0 });
  
  // State untuk Level 3: Sorting & Secure PIN
  const [sortBy, setSortBy] = useState('newest'); 
  const [newPin, setNewPin] = useState('');       // Untuk input set PIN baru
  const [enteredPin, setEnteredPin] = useState(''); // Untuk input verifikasi buka kunci
  const [savedPin, setSavedPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(true); // Default true, akan jadi false di loadPin jika ada PIN

  // READ: Memuat semua data saat aplikasi pertama kali dibuka
  useEffect(() => {
    loadInitialData();
    loadPin(); // Memanggil fungsi load PIN baru
  }, []);

  const loadInitialData = async () => {
    try {
      // 1. Load Data Tugas
      const savedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTasks !== null) {
        setTaskList(JSON.parse(savedTasks));
      }

      // 2. Load Data Statistik
      const savedStats = await AsyncStorage.getItem(STATS_KEY);
      if (savedStats !== null) {
        setStats(JSON.parse(savedStats));
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal memuat data dari penyimpanan.');
    }
  };

  // Ambil PIN saat aplikasi dibuka sesuai instruksi baru
  const loadPin = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setSavedPin(pin);
        setIsUnlocked(false); // Kunci aplikasi jika PIN ditemukan
      }
    } catch (error) {
      console.log(error);
    }
  };

  // Sinkronisasi Data Tugas & Statistik ke AsyncStorage
  const syncStorage = async (newTasks, updatedStats) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(updatedStats));
    } catch (error) {
      Alert.alert('Error', 'Gagal menyinkronkan data.');
    }
  };

  // Simpan PIN sesuai instruksi baru
  const savePin = async () => {
    if (newPin.length < 4) {
      Alert.alert('PIN minimal 4 digit');
      return;
    }
    try {
      await SecureStore.setItemAsync(PIN_KEY, newPin);
      setSavedPin(newPin);
      setNewPin('');
      setIsUnlocked(false); // Langsung kunci setelah berhasil set PIN
      Alert.alert('Berhasil', 'PIN berhasil disimpan');
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan PIN');
    }
  };

  // Verifikasi PIN sesuai instruksi baru
  const checkPin = () => {
    if (enteredPin === savedPin) {
      setIsUnlocked(true);
      setEnteredPin('');
    } else {
      Alert.alert('PIN Salah');
    }
  };

  // Reset PIN sesuai instruksi baru
  const resetPin = async () => {
    Alert.alert(
      'Reset PIN',
      'Yakin ingin menghapus PIN?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          onPress: async () => {
            await SecureStore.deleteItemAsync(PIN_KEY);
            setSavedPin('');
            setIsUnlocked(true);
            setNewPin('');
            setEnteredPin('');
            Alert.alert('PIN berhasil dihapus');
          }
        }
      ]
    );
  };

  // CREATE: Tambah Item Baru
  const handleAddTask = () => {
    if (task.trim() === '') {
      Alert.alert('Peringatan', 'Tugas tidak boleh kosong!');
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      text: task,
      isCompleted: false,
      createdAt: Date.now()
    };

    const updatedTasks = [...taskList, newTask];
    const updatedStats = { ...stats, totalCreated: stats.totalCreated + 1 };

    setTaskList(updatedTasks);
    setStats(updatedStats);
    syncStorage(updatedTasks, updatedStats);
    setTask(''); 
  };

  // UPDATE: Toggle Status Selesai
  const handleToggleComplete = (id) => {
    let completedDiff = 0;
    
    const updatedTasks = taskList.map(item => {
      if (item.id === id) {
        const nextState = !item.isCompleted;
        completedDiff = nextState ? 1 : -1;
        return { ...item, isCompleted: nextState };
      }
      return item;
    });

    const updatedStats = { 
      ...stats, 
      totalCompleted: Math.max(0, stats.totalCompleted + completedDiff) 
    };

    setTaskList(updatedTasks);
    setStats(updatedStats);
    syncStorage(updatedTasks, updatedStats);
  };

  // DELETE: Hapus Item Tunggal
  const handleDeleteTask = (id) => {
    Alert.alert(
      'Hapus Tugas',
      'Yakin ingin menghapus tugas ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const targetItem = taskList.find(item => item.id === id);
            const filteredTasks = taskList.filter(item => item.id !== id);
            
            const updatedStats = {
              ...stats,
              totalCompleted: targetItem?.isCompleted ? Math.max(0, stats.totalCompleted - 1) : stats.totalCompleted
            };

            setTaskList(filteredTasks);
            setStats(updatedStats);
            syncStorage(filteredTasks, updatedStats);
          }
        }
      ]
    );
  };

  // HAPUS SEMUA
  const handleClearAll = () => {
    if (taskList.length === 0) return;

    Alert.alert(
      'Hapus Semua',
      'Apakah kamu yakin ingin mengosongkan seluruh daftar tugas?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            const clearedStats = { ...stats, totalCompleted: 0 };
            setTaskList([]);
            setStats(clearedStats);
            await AsyncStorage.removeItem(STORAGE_KEY);
            await AsyncStorage.setItem(STATS_KEY, JSON.stringify(clearedStats));
          }
        }
      ]
    );
  };

  // Logic Sorting Array & Filtering Search
  const getSortedTasks = () => {
    const tasksCopy = [...taskList];
    
    const filteredTasks = tasksCopy.filter(item =>
      item.text.toLowerCase().includes(search.toLowerCase())
    );

    if (sortBy === 'newest') {
      return filteredTasks.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'uncompleted') {
      return filteredTasks.sort((a, b) => (a.isCompleted === b.isCompleted) ? 0 : a.isCompleted ? 1 : -1);
    }
    return filteredTasks;
  };

  // RENDER PADA SAAT APLIKASI TERKUNCI PIN (!isUnlocked)
  if (!isUnlocked) {
    return (
      <SafeAreaView style={styles.lockContainer}>
        <Text style={styles.lockTitle}>🔒 Aplikasi Terkunci</Text>
        <Text style={styles.lockSubtitle}>Masukkan PIN SecureStore kamu untuk melanjutkan</Text>
        <TextInput
          style={[styles.input, { width: '80%', textAlign: 'center', marginBottom: 15 }]}
          placeholder="Masukkan 4 Digit PIN"
          placeholderTextColor="#aaa"
          secureTextEntry
          keyboardType="numeric"
          maxLength={4}
          value={enteredPin}
          onChangeText={setEnteredPin}
        />
        <TouchableOpacity style={styles.addButton} onPress={checkPin}>
          <Text style={[styles.addButtonText, { fontSize: 16, paddingVertical: 10, paddingHorizontal: 10 }]}>Buka Kunci</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>📋 TaskMaster Premium</Text>

      {/* TAMPILAN STATISTIK */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalCreated}</Text>
          <Text style={styles.statLabel}>Total Dibuat</Text>
        </View>
        <View style={[styles.statBox, { borderColor: '#4CAF50' }]}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.totalCompleted}</Text>
          <Text style={styles.statLabel}>Total Selesai</Text>
        </View>
      </View>

      {/* Input Tambah Tugas Baru */}
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input}
          placeholder="Tambah tugas baru..."
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Input Pencarian Tugas */}
      <View style={[styles.inputContainer, { paddingTop: 0 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: '#e9ecef' }]}
          placeholder="🔍 Cari tugas..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* OPSI SORTING & TOMBOL HAPUS ALL */}
      <View style={styles.actionRow}>
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Urutkan: </Text>
          <TouchableOpacity 
            style={[styles.sortBadge, sortBy === 'newest' && styles.sortBadgeActive]} 
            onPress={() => setSortBy('newest')}
          >
            <Text style={[styles.sortBadgeText, sortBy === 'newest' && styles.sortBadgeTextActive]}>Terbaru</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortBadge, sortBy === 'uncompleted' && styles.sortBadgeActive]} 
            onPress={() => setSortBy('uncompleted')}
          >
            <Text style={[styles.sortBadgeText, sortBy === 'uncompleted' && styles.sortBadgeTextActive]}>Belum Selesai</Text>
          </TouchableOpacity>
        </View>

        {taskList.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearButtonText}>Hapus Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* RENDER FLATLIST DENGAN TIMESTAMP */}
      <FlatList
        data={getSortedTasks()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <TouchableOpacity 
              style={styles.taskTextContainer} 
              onPress={() => handleToggleComplete(item.id)}
            >
              <Text style={[
                styles.taskText, 
                item.isCompleted && styles.taskTextDone
              ]}>
                {item.isCompleted ? '✅ ' : '⬜ '} {item.text}
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => handleDeleteTask(item.id)}
            >
              <Text style={styles.deleteButtonText}>❌</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada tugas ditemukan. Mantap! 😎</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      />

      {/* FITUR SECURESTORE FOOTER PANEL */}
      <View style={styles.secureSetupContainer}>
        {savedPin === '' ? (
          <>
            <Text style={styles.secureSetupTitle}>🔐 Kunci App dengan SecureStore PIN:</Text>
            <View style={{ flexDirection: 'row', marginTop: 5 }}>
              <TextInput
                style={[styles.input, { padding: 8, fontSize: 14 }]}
                placeholder="Set 4 Angka PIN"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={newPin}
                onChangeText={setNewPin}
              />
              <TouchableOpacity style={[styles.addButton, { paddingHorizontal: 15 }]} onPress={savePin}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Set PIN</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={resetPin}>
            <Text style={{ color: '#dc3545', fontWeight: 'bold', textAlign: 'center', paddingVertical: 5 }}>
              ❌ Hapus PIN Aplikasi
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 10, color: '#333' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3b5998', marginHorizontal: 5, elevation: 1 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#3b5998' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10 },
  input: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 10, fontSize: 16, color: '#333' },
  addButton: { backgroundColor: '#3b5998', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sortContainer: { flexDirection: 'row', alignItems: 'center' },
  sortLabel: { fontSize: 12, color: '#666' },
  sortBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e9ecef', marginRight: 5 },
  sortBadgeActive: { backgroundColor: '#3b5998' },
  sortBadgeText: { fontSize: 11, color: '#495057' },
  sortBadgeTextActive: { color: '#fff', fontWeight: 'bold' },
  clearButtonText: { color: '#dc3545', fontWeight: 'bold', fontSize: 13 },
  taskCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  taskTextContainer: { flex: 1 },
  taskText: { fontSize: 16, color: '#333' },
  taskTextDone: { textDecorationLine: 'line-through', color: '#aaa' },
  deleteButton: { padding: 5 },
  deleteButtonText: { fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#777', fontSize: 15, textAlign: 'center' },
  dateText: { fontSize: 11, color: '#888', marginTop: 4 },
  lockContainer: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },
  lockTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  lockSubtitle: { fontSize: 14, color: '#666', marginBottom: 25, textAlign: 'center', paddingHorizontal: 30 },
  secureSetupContainer: { backgroundColor: '#fff', padding: 15, borderTopWidth: 1, borderColor: '#eee', elevation: 5 },
  secureSetupTitle: { fontSize: 12, fontWeight: 'bold', color: '#555' }
});