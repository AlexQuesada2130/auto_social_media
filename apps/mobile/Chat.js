import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from "react-native";
import Constants from "expo-constants";

// El puente corre en el Mac. Por defecto, la misma máquina que la API pero en
// el puerto 3200. Se puede cambiar desde la propia pantalla.
function puenteDefecto() {
  const api = Constants.expoConfig?.extra?.apiUrl || "";
  const m = api.match(/^https?:\/\/([^:/]+)/);
  return m ? `http://${m[1]}:3200` : "";
}

export default function Chat({ c, s, token }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState(puenteDefecto());
  const [ajustes, setAjustes] = useState(false);
  const scroll = useRef(null);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const conmigo = [...mensajes, { de: "yo", texto: limpio }];
    setMensajes(conmigo);
    setTexto("");
    setPensando(true);
    setError("");

    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mensajes: conmigo }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || `El puente respondió ${res.status}`);
      setMensajes([...conmigo, { de: "claude", texto: datos.texto }]);
    } catch (e) {
      // El fallo típico es que el Mac esté apagado o fuera de la red.
      setError(
        e.message === "Network request failed"
          ? "No llego al puente. ¿Está el Mac encendido y corriendo puente.py, y estás en la misma red?"
          : e.message,
      );
      setMensajes(conmigo);
    }
    setPensando(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.chatLista}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.length === 0 && !ajustes ? (
          <View style={s.vacio}>
            <Text style={s.vacioTitulo}>Habla del borrador</Text>
            <Text style={s.vacioTexto}>
              Pega un post y pide que lo acorte, que le cambie el gancho o que te
              diga qué sobra. Va contra tu Claude del Mac, así que no cuesta nada.
            </Text>
          </View>
        ) : null}

        {mensajes.map((m, i) => (
          <View
            key={i}
            style={[s.burbuja, m.de === "yo" ? s.burbujaMia : s.burbujaSuya]}
          >
            <Text style={m.de === "yo" ? s.burbujaMiaTexto : s.burbujaSuyaTexto}>
              {m.texto}
            </Text>
          </View>
        ))}

        {pensando ? (
          <View style={[s.burbuja, s.burbujaSuya, { flexDirection: "row", gap: 8 }]}>
            <ActivityIndicator size="small" color={c.suave} />
            <Text style={s.burbujaSuyaTexto}>Pensando…</Text>
          </View>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {ajustes ? (
          <View style={s.echar}>
            <Text style={s.echarLabel}>DIRECCIÓN DEL PUENTE</Text>
            <TextInput
              style={s.campo} value={url} onChangeText={setUrl}
              autoCapitalize="none" autoCorrect={false}
              placeholder="http://192.168.1.29:3200" placeholderTextColor={c.tenue}
              accessibilityLabel="Dirección del puente"
            />
            <Text style={s.vacioTexto}>
              La que imprime puente.py al arrancar. Cambia si cambias de red.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.chatPie}>
        <Pressable onPress={() => setAjustes((a) => !a)} style={s.boton}>
          <Text style={s.botonTexto}>{ajustes ? "Listo" : "⚙"}</Text>
        </Pressable>
        <TextInput
          style={[s.campo, { flex: 1 }]} value={texto} onChangeText={setTexto}
          placeholder="Escribe aquí" placeholderTextColor={c.tenue}
          multiline accessibilityLabel="Mensaje"
        />
        <Pressable
          onPress={enviar} disabled={pensando || !texto.trim()}
          style={[s.boton, s.botonPrimario, (pensando || !texto.trim()) && s.botonApagado]}
        >
          <Text style={s.botonPrimarioTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
