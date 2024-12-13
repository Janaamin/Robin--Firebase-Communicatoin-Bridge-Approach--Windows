import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, Button } from "react-native";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseConfig";

const BirdHistoryScreen = ({ navigation }) => {
  const [birds, setBirds] = useState([]);

  useEffect(() => {
    const birdsCollection = collection(db, "birds");
    const q = query(birdsCollection, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const birdData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      }));
      setBirds(birdData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bird Detection History</Text>
      {birds.length > 0 ? (
        <FlatList
          data={birds}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.birdItem}>
              <Text style={styles.birdName}>{item.bird}</Text>
              <Text style={styles.info}>{`Latitude: ${item.latitude}, Longitude: ${item.longitude}`}</Text>
              <Text style={styles.info}>
                {`Timestamp: ${item.timestamp.toLocaleString()}`}
              </Text>
            </View>
          )}
        />
      ) : (
        <Text style={styles.info}>No bird history available...</Text>
      )}
      <Button title="Back to Real-Time Detection" onPress={() => navigation.navigate("BirdDetection")} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  birdItem: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 10,
  },
  birdName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "blue",
  },
  info: {
    fontSize: 16,
  },
});

export default BirdHistoryScreen;
