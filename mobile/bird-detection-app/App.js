import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack"; 
import BirdDetectionScreen from "./BirdDetectionScreen"; // Real-Time Detection Page
import BirdHistoryScreen from "./BirdHistoryScreen"; // History Page

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="BirdDetection">
        <Stack.Screen
          name="BirdDetection"
          component={BirdDetectionScreen}
          options={{ title: "Real-Time Bird Detection" }}
        />
        <Stack.Screen
          name="BirdHistory"
          component={BirdHistoryScreen}
          options={{ title: "Bird Detection History" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
