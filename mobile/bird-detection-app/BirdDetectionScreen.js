import React, { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Button, ActivityIndicator } from "react-native";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebaseConfig";
import axios from "axios";

// Replace with your Unsplash Access Key
const UNSPLASH_ACCESS_KEY = "OW9_nKN_e_TWvCdmTMB7nuntkSeNR8sSnQzEucwxd-k";

const BirdDetectionScreen = ({ navigation }) => {
  const [latestBird, setLatestBird] = useState(null); // State to store the latest bird
  const [birdImage, setBirdImage] = useState(null); // State to store the bird image
  const [loading, setLoading] = useState(false); // Loading state for the image

  useEffect(() => {
    // Query to fetch the most recent bird record
    const birdsCollection = collection(db, "birds");
    const q = query(birdsCollection, orderBy("timestamp", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const birdData = snapshot.docs[0].data();
        const birdDetails = {
          bird: birdData.bird,
          latitude: birdData.latitude,
          longitude: birdData.longitude,
          timestamp: birdData.timestamp.toDate(), // Convert Firestore Timestamp to Date
        };
        setLatestBird(birdDetails);

        // Fetch the bird image from Unsplash
        await fetchBirdImage(birdDetails.bird);
      }
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  const fetchBirdImage = async (birdName) => {
    setLoading(true);
    try {
      const response = await axios.get(`https://api.unsplash.com/search/photos`, {
        params: {
          query: birdName,
          client_id: UNSPLASH_ACCESS_KEY,
          per_page: 1,
        },
      });

      if (response.data.results.length > 0) {
        setBirdImage(response.data.results[0].urls.small); // Set the first image URL
      } else {
        setBirdImage(null); // No image found
      }
    } catch (error) {
      console.error("Error fetching bird image:", error);
      setBirdImage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {latestBird ? (
        <View>
          <Text style={styles.title}>Latest Bird Detection</Text>
          <Text style={styles.birdName}>{latestBird.bird}</Text>
          <Text style={styles.info}>
            Latitude: {latestBird.latitude}, Longitude: {latestBird.longitude}
          </Text>
          <Text style={styles.info}>
            Timestamp: {latestBird.timestamp.toLocaleString()}
          </Text>
          {loading ? (
            <ActivityIndicator size="large" color="#00ff00" />
          ) : birdImage ? (
            <Image source={{ uri: birdImage }} style={styles.image} />
          ) : (
            <Text style={styles.info}>No image available for this bird.</Text>
          )}
        </View>
      ) : (
        <Text style={styles.info}>No bird detected yet...</Text>
      )}
      <Button
        title="View Detection History"
        onPress={() => navigation.navigate("BirdHistory")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  birdName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "green",
  },
  info: {
    fontSize: 16,
    marginTop: 5,
  },
  image: {
    width: 300,
    height: 200,
    marginTop: 10,
    borderRadius: 10,
  },
});

export default BirdDetectionScreen;
