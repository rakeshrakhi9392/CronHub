import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createApiKey,
  createJob,
  createTenant,
  listJobs,
  type JobResponse,
} from './src/api';

type RootStackParamList = {
  Home: undefined;
  Jobs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const STORAGE_KEYS = {
  tenantId: 'chronoflow.tenantId',
  apiKey: 'chronoflow.apiKey',
};

function HomeScreen({ navigation }: { navigation: { navigate: (s: 'Jobs') => void } }) {
  const [tenantName, setTenantName] = useState('demo-tenant-mobile');
  const [tenantId, setTenantId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [jobName, setJobName] = useState('demo-job-mobile');
  const [cronExpression, setCronExpression] = useState('*/2 * * * *');
  const [targetUrl, setTargetUrl] = useState('https://httpbin.org/post');
  const [log, setLog] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const storedTenant = await AsyncStorage.getItem(STORAGE_KEYS.tenantId);
      const storedKey = await AsyncStorage.getItem(STORAGE_KEYS.apiKey);
      if (storedTenant) setTenantId(storedTenant);
      if (storedKey) setApiKey(storedKey);
    })();
  }, []);

  async function runStep(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setLog((prev) => `${label} succeeded.\n${prev}`);
    } catch (err) {
      setLog((prev) => `${label} failed: ${err instanceof Error ? err.message : String(err)}\n${prev}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>ChronoFlow Admin</Text>
        <Text style={styles.subtitle}>Expo mobile console for tenant, API key, and job flows.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1) Create Tenant</Text>
          <TextInput style={styles.input} value={tenantName} onChangeText={setTenantName} />
          <Pressable
            style={styles.button}
            disabled={busy}
            onPress={() =>
              runStep('Create tenant', async () => {
                const tenant = await createTenant(tenantName);
                setTenantId(tenant.id);
                await AsyncStorage.setItem(STORAGE_KEYS.tenantId, tenant.id);
              })
            }
          >
            <Text style={styles.buttonText}>Create Tenant</Text>
          </Pressable>
          <Text style={styles.meta}>Tenant ID: {tenantId || '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2) Create API Key</Text>
          <Pressable
            style={styles.button}
            disabled={busy || !tenantId}
            onPress={() =>
              runStep('Create API key', async () => {
                const key = await createApiKey(tenantId);
                const credential = `${key.keyId}:${key.keySecret}`;
                setApiKey(credential);
                await AsyncStorage.setItem(STORAGE_KEYS.apiKey, credential);
              })
            }
          >
            <Text style={styles.buttonText}>Create API Key</Text>
          </Pressable>
          <Text style={styles.meta}>API Key: {apiKey ? 'stored' : '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3) Create Job (via Gateway)</Text>
          <TextInput style={styles.input} value={jobName} onChangeText={setJobName} />
          <TextInput style={styles.input} value={cronExpression} onChangeText={setCronExpression} />
          <TextInput style={styles.input} value={targetUrl} onChangeText={setTargetUrl} />
          <Pressable
            style={styles.button}
            disabled={busy || !tenantId || !apiKey}
            onPress={() =>
              runStep('Create job', async () => {
                await createJob(apiKey, {
                  tenantId,
                  name: jobName,
                  cronExpression,
                  targetUrl,
                });
              })
            }
          >
            <Text style={styles.buttonText}>Create Job</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, styles.secondaryButton]}
          disabled={busy || !tenantId || !apiKey}
          onPress={() => navigation.navigate('Jobs')}
        >
          <Text style={styles.buttonText}>View Jobs</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity</Text>
          <Text style={styles.log}>{log}</Text>
        </View>

        {busy ? <ActivityIndicator color="#93c5fd" /> : null}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function JobsScreen() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const tenantId = await AsyncStorage.getItem(STORAGE_KEYS.tenantId);
        const apiKey = await AsyncStorage.getItem(STORAGE_KEYS.apiKey);
        if (!tenantId || !apiKey) {
          setError('Create tenant and API key first.');
          return;
        }
        const result = await listJobs(apiKey, tenantId);
        setJobs(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#93c5fd" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.title}>Jobs</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>ID: {item.id}</Text>
            <Text style={styles.meta}>Cron: {item.cronExpression}</Text>
            <Text style={styles.meta}>Status: {item.status}</Text>
            <Text style={styles.meta}>Target: {item.targetUrl}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.meta}>No jobs yet.</Text>}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#e2e8f0',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Jobs" component={JobsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#94a3b8', marginBottom: 8 },
  card: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  cardTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: '#0b1220',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 6,
    color: '#e2e8f0',
    padding: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: '#334155' },
  buttonText: { color: '#fff', fontWeight: '600' },
  meta: { color: '#94a3b8', fontSize: 13 },
  log: { color: '#cbd5e1', fontSize: 13 },
  error: { color: '#fca5a5' },
});
