import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Linking, Pressable, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View, useColorScheme,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { partirPorPliegue, revisar, LIMITE_CARACTERES, URL_COMPOSITOR } from "@mesa/shared";
import { cargarToken, entrar, salir, listar, parchear } from "./api";

const YO = { iniciales: "AQ", nombre: "Alejandro Gabriel Quesada Sánchez" };

const FILTROS = [
  { id: "pendiente", nombre: "Pendientes" },
  { id: "aprobado", nombre: "Aprobados" },
  { id: "descartado", nombre: "Descartados" },
];

function paleta(oscuro) {
  return oscuro
    ? { papel: "#15140f", tarjeta: "#1e1d18", tinta: "#ece8e0", suave: "#a39d93",
        tenue: "#7d766c", linea: "#33302a", acento: "#e2795a", acentoBg: "#3a2119",
        ok: "#7bc09f", okBg: "#1b2f26", campo: "#26241f" }
    : { papel: "#f1efe9", tarjeta: "#ffffff", tinta: "#1f1d1a", suave: "#6a655d",
        tenue: "#938d84", linea: "#ddd8cf", acento: "#b4472b", acentoBg: "#f7e6e0",
        ok: "#2d6349", okBg: "#e0ece6", campo: "#faf9f6" };
}

export default function App() {
  const c = paleta(useColorScheme() === "dark");
  const s = estilos(c);

  const [arrancando, setArrancando] = useState(true);
  const [dentro, setDentro] = useState(false);
  const [borradores, setBorradores] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const { borradores } = await listar();
      setBorradores(borradores);
      setDentro(true);
      setError("");
    } catch (e) {
      if (e.sesionCaducada) setDentro(false);
      else setError(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await cargarToken();
      if (t) await cargar();
      setArrancando(false);
    })();
  }, [cargar]);

  async function cambiar(id, cambios) {
    try {
      await parchear(id, cambios);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  if (arrancando) {
    return (
      <SafeAreaView style={s.centro}>
        <ActivityIndicator color={c.acento} />
      </SafeAreaView>
    );
  }

  if (!dentro) return <Puerta c={c} s={s} alEntrar={cargar} />;

  const visibles = borradores.filter((d) => (d.estado || "pendiente") === filtro);
  const nPend = borradores.filter((d) => (d.estado || "pendiente") === "pendiente").length;

  return (
    <SafeAreaView style={s.pantalla}>
      <StatusBar style="auto" />
      <View style={s.cabecera}>
        <Text style={s.titulo}>Mesa de Redacción</Text>
        <Text style={s.cuenta}>{nPend} pendientes</Text>
      </View>

      <View style={s.pestanas}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.id} onPress={() => setFiltro(f.id)}
            style={[s.pestana, filtro === f.id && s.pestanaViva]}
            accessibilityRole="tab" accessibilityState={{ selected: filtro === f.id }}
          >
            <Text style={[s.pestanaTexto, filtro === f.id && s.pestanaTextoVivo]}>{f.nombre}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={s.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando} tintColor={c.acento}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
          />
        }
      >
        {visibles.length === 0 ? (
          <View style={s.vacio}>
            <Text style={s.vacioTitulo}>Nada por aquí</Text>
            <Text style={s.vacioTexto}>Desliza hacia abajo para comprobar si hay propuestas nuevas.</Text>
          </View>
        ) : (
          visibles.map((d) => (
            <Tarjeta key={d.id} c={c} s={s} borrador={d} onCambiar={cambiar} />
          ))
        )}

        <Pressable onPress={async () => { await salir(); setDentro(false); }} style={s.salir}>
          <Text style={s.salirTexto}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Puerta({ c, s, alEntrar }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function probar() {
    setEnviando(true);
    setError("");
    try {
      await entrar(password);
      await alEntrar();
    } catch (e) {
      setError(e.message);
    }
    setEnviando(false);
  }

  return (
    <SafeAreaView style={s.pantalla}>
      <StatusBar style="auto" />
      <View style={s.puerta}>
        <Text style={s.titulo}>Mesa de Redacción</Text>
        <Text style={s.vacioTexto}>Introduce la contraseña para ver la cola.</Text>
        <TextInput
          style={s.campo} value={password} onChangeText={setPassword}
          secureTextEntry autoFocus placeholder="Contraseña"
          placeholderTextColor={c.tenue} onSubmitEditing={probar}
          accessibilityLabel="Contraseña"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable
          onPress={probar} disabled={enviando || !password}
          style={[s.boton, s.botonPrimario, (enviando || !password) && s.botonApagado]}
        >
          <Text style={s.botonPrimarioTexto}>{enviando ? "Comprobando…" : "Entrar"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Tarjeta({ c, s, borrador, onCambiar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(borrador.texto || "");
  const [copiado, setCopiado] = useState(false);

  const estado = borrador.estado || "pendiente";
  const actual = editando ? texto : borrador.texto || "";
  const [antes, despues] = partirPorPliegue(actual);
  const avisos = revisar(actual);

  async function copiar() {
    await Clipboard.setStringAsync(actual);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  async function abrirLinkedIn() {
    await copiar();
    const url = URL_COMPOSITOR + encodeURIComponent(actual);
    Linking.openURL(url.length <= 8000 ? url : "https://www.linkedin.com/feed/");
  }

  return (
    <View style={[s.tarjeta, estado === "aprobado" && s.tarjetaOk,
                  estado === "descartado" && s.tarjetaOff]}>
      <View style={s.tarjetaTop}>
        <Text style={[s.insignia, estado === "aprobado" ? s.insigniaOk : s.insigniaPend]}>
          {estado.toUpperCase()}
        </Text>
        <Text style={s.origen} numberOfLines={1}>{borrador.origen || "propuesta"}</Text>
      </View>

      <View style={s.cuerpo}>
        <View style={s.quien}>
          <View style={s.avatar}><Text style={s.avatarTexto}>{YO.iniciales}</Text></View>
          <Text style={s.quienNombre} numberOfLines={1}>{YO.nombre}</Text>
        </View>

        {editando ? (
          <>
            <TextInput
              style={s.area} value={texto} onChangeText={setTexto}
              multiline accessibilityLabel="Texto del post"
            />
            <Text style={[s.contador, texto.length > LIMITE_CARACTERES && s.contadorPasado]}>
              {texto.length} / {LIMITE_CARACTERES}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.post}>{antes}</Text>
            {despues ? (
              <>
                <Text style={s.pliegue}>— pliegue · ver más —</Text>
                <Text style={s.post}>{despues}</Text>
              </>
            ) : null}
            {avisos.length > 0 && (
              <View style={s.avisos}>
                {avisos.map((a) => <Text key={a} style={s.avisoTexto}>• {a}</Text>)}
              </View>
            )}
            {borrador.notaVisual ? (
              <Text style={s.nota}>Visual: {borrador.notaVisual}</Text>
            ) : null}
          </>
        )}
      </View>

      <View style={s.acciones}>
        {editando ? (
          <>
            <Pressable
              style={[s.boton, s.botonPrimario]}
              onPress={() => { setEditando(false); onCambiar(borrador.id, { texto: texto.trim() }); }}
            >
              <Text style={s.botonPrimarioTexto}>Guardar</Text>
            </Pressable>
            <Pressable style={s.boton} onPress={() => { setTexto(borrador.texto || ""); setEditando(false); }}>
              <Text style={s.botonTexto}>Cancelar</Text>
            </Pressable>
          </>
        ) : (
          <>
            {estado !== "aprobado" && (
              <Pressable style={[s.boton, s.botonPrimario]} onPress={() => onCambiar(borrador.id, { estado: "aprobado" })}>
                <Text style={s.botonPrimarioTexto}>Aprobar</Text>
              </Pressable>
            )}
            <Pressable style={s.boton} onPress={copiar}>
              <Text style={s.botonTexto}>{copiado ? "Copiado" : "Copiar"}</Text>
            </Pressable>
            <Pressable style={s.boton} onPress={abrirLinkedIn}>
              <Text style={s.botonTexto}>LinkedIn</Text>
            </Pressable>
            <Pressable style={s.boton} onPress={() => setEditando(true)}>
              <Text style={s.botonTexto}>Editar</Text>
            </Pressable>
            <Pressable
              style={s.boton}
              onPress={() => onCambiar(borrador.id, { estado: estado === "descartado" ? "pendiente" : "descartado" })}
            >
              <Text style={s.botonTexto}>{estado === "descartado" ? "Recuperar" : "Descartar"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function estilos(c) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: c.papel },
    centro: { flex: 1, backgroundColor: c.papel, alignItems: "center", justifyContent: "center" },
    cabecera: {
      flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
      borderBottomWidth: 2, borderBottomColor: c.tinta,
    },
    titulo: { fontSize: 24, fontWeight: "700", color: c.tinta, letterSpacing: -0.5 },
    cuenta: { fontSize: 11, color: c.tenue, textTransform: "uppercase", letterSpacing: 0.6 },
    pestanas: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.linea },
    pestana: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
    pestanaViva: { borderBottomColor: c.acento },
    pestanaTexto: { fontSize: 13, color: c.suave },
    pestanaTextoVivo: { color: c.tinta, fontWeight: "700" },
    lista: { padding: 16, gap: 16, paddingBottom: 48 },
    vacio: { borderWidth: 1, borderStyle: "dashed", borderColor: c.linea, padding: 28, alignItems: "center", gap: 6 },
    vacioTitulo: { fontSize: 17, fontWeight: "600", color: c.tinta },
    vacioTexto: { fontSize: 13, color: c.suave, textAlign: "center" },
    error: { color: c.acento, fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },

    tarjeta: { backgroundColor: c.tarjeta, borderWidth: 1, borderColor: c.linea, borderLeftWidth: 3, borderLeftColor: c.acento },
    tarjetaOk: { borderLeftColor: c.ok },
    tarjetaOff: { borderLeftColor: c.tenue, opacity: 0.62 },
    tarjetaTop: {
      flexDirection: "row", alignItems: "center", gap: 8, padding: 11,
      borderBottomWidth: 1, borderBottomColor: c.linea,
    },
    insignia: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
    insigniaPend: { backgroundColor: c.acentoBg, color: c.acento },
    insigniaOk: { backgroundColor: c.okBg, color: c.ok },
    origen: { fontSize: 12, color: c.tenue, flexShrink: 1 },

    cuerpo: { padding: 14 },
    quien: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1f3a5c", alignItems: "center", justifyContent: "center" },
    avatarTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
    quienNombre: { fontSize: 13, fontWeight: "600", color: c.tinta, flexShrink: 1 },
    post: { fontSize: 15, lineHeight: 22, color: c.tinta },
    pliegue: { fontSize: 10, color: c.acento, letterSpacing: 0.8, marginVertical: 9, textTransform: "uppercase" },
    avisos: { marginTop: 12, padding: 10, backgroundColor: c.acentoBg, gap: 3 },
    avisoTexto: { fontSize: 12, color: c.acento },
    nota: { marginTop: 12, padding: 10, backgroundColor: c.campo, fontSize: 12, color: c.suave },

    area: { backgroundColor: c.campo, borderWidth: 1, borderColor: c.linea, borderRadius: 3,
            padding: 10, minHeight: 200, color: c.tinta, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
    contador: { fontSize: 12, color: c.tenue, marginTop: 6 },
    contadorPasado: { color: c.acento, fontWeight: "700" },

    acciones: { flexDirection: "row", flexWrap: "wrap", gap: 7, padding: 12, borderTopWidth: 1, borderTopColor: c.linea },
    boton: { borderWidth: 1, borderColor: c.linea, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: c.tarjeta },
    botonTexto: { fontSize: 13, color: c.tinta },
    botonPrimario: { backgroundColor: c.acento, borderColor: c.acento },
    botonPrimarioTexto: { fontSize: 13, color: "#fff", fontWeight: "600" },
    botonApagado: { opacity: 0.45 },

    puerta: { padding: 24, gap: 12, marginTop: "30%" },
    campo: { backgroundColor: c.campo, borderWidth: 1, borderColor: c.linea, borderRadius: 3, padding: 12, color: c.tinta, fontSize: 16 },

    salir: { alignItems: "center", paddingVertical: 20 },
    salirTexto: { fontSize: 13, color: c.tenue },
  });
}
