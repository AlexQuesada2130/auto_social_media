import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  useColorScheme, useWindowDimensions, View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { partirPorPliegue, revisar, LIMITE_CARACTERES, URL_COMPOSITOR } from "@mesa/shared";
import { cargarToken, haySesion, entrar, salir, listar, parchear, crear, registrarPush, tokenActual } from "./api";
import { capacidad, preferencia, guardarPreferencia, desbloquear } from "./sesion";
import { registrarParaPush } from "./notificaciones";
import { metricas, paleta, sombra } from "./diseno";
import Chat from "./Chat";

const YO = {
  nombre: "Alejandro Gabriel Quesada Sánchez",
  rol: "Desarrollador & Especialista en Automatización | Consultor Comercial IT",
  iniciales: "AQ",
};

const FILTROS = [
  { id: "pendiente", nombre: "Pendientes" },
  { id: "aprobado", nombre: "Aprobados" },
  { id: "descartado", nombre: "Descartados" },
];

const VACIO = {
  pendiente: ["Nada pendiente", "Desliza hacia abajo para comprobar si hay propuestas nuevas."],
  aprobado: ["Nada aprobado", "Lo que apruebes se queda aquí, listo para publicar."],
  descartado: ["Nada descartado", "Lo que rechaces se guarda por si cambias de idea."],
};

const toque = (tipo = "ligero") => {
  if (Platform.OS !== "ios") return;
  const estilo = {
    ligero: Haptics.ImpactFeedbackStyle.Light,
    medio: Haptics.ImpactFeedbackStyle.Medium,
  }[tipo];
  if (estilo) Haptics.impactAsync(estilo).catch(() => {});
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Pantalla />
    </SafeAreaProvider>
  );
}

function Pantalla() {
  const oscuro = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = paleta(oscuro);
  const m = metricas(width);
  const s = estilos(c, m, insets);

  const [arrancando, setArrancando] = useState(true);
  const [dentro, setDentro] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [bio, setBio] = useState({ disponible: false, nombre: "Face ID" });
  const [bioActivo, setBioActivo] = useState(false);
  const [borradores, setBorradores] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [vista, setVista] = useState("cola");
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState("");
  const [avisoPush, setAvisoPush] = useState(null);
  const [idea, setIdea] = useState("");
  const [guardando, setGuardando] = useState(false);

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

  const abrirConBiometria = useCallback(async (nombre) => {
    const { ok, motivo } = await desbloquear(nombre);
    if (!ok) {
      if (motivo) setError(motivo);
      return false;
    }
    setBloqueado(false);
    setError("");
    const t = await cargarToken();
    if (t) await cargar();
    return true;
  }, [cargar]);

  useEffect(() => {
    (async () => {
      const cap = await capacidad();
      const quiere = await preferencia();
      setBio(cap);
      setBioActivo(quiere && cap.disponible);

      const guardada = await haySesion();
      if (guardada && quiere && cap.disponible) {
        // Hay sesión, pero no se abre hasta que lo autorice la cara.
        setBloqueado(true);
        setArrancando(false);
        await abrirConBiometria(cap.nombre);
        return;
      }
      const t = await cargarToken();
      if (t) await cargar();
      setArrancando(false);
    })();
  }, [cargar, abrirConBiometria]);

  // El permiso se pide ya dentro, no en la pantalla de contraseña: pedirlo
  // antes de que se vea para qué sirve se lleva un "no" casi seguro.
  useEffect(() => {
    if (!dentro) return;
    (async () => {
      const { token, motivo } = await registrarParaPush();
      if (!token) return setAvisoPush(motivo);
      try {
        await registrarPush(token);
        setAvisoPush(null);
      } catch (e) {
        setAvisoPush(e.message);
      }
    })();
  }, [dentro]);

  async function cambiar(id, cambios) {
    toque(cambios.estado === "aprobado" ? "exito" : "ligero");
    // Pintado optimista: el toque responde al instante y el servidor confirma.
    setBorradores((bs) => bs.map((b) => (b.id === id ? { ...b, ...cambios } : b)));
    try {
      await parchear(id, cambios);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    }
  }

  async function echarIdea() {
    const texto = idea.trim();
    if (!texto) return;
    setGuardando(true);
    Keyboard.dismiss();
    try {
      await crear(texto);
      setIdea("");
      setFiltro("pendiente");
      toque("exito");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  if (arrancando) {
    return (
      <View style={s.centro}>
        <StatusBar style={oscuro ? "light" : "dark"} />
        <ActivityIndicator color={c.acento} />
      </View>
    );
  }

  if (bloqueado && !dentro) {
    return (
      <View style={s.pantalla}>
        <StatusBar style={oscuro ? "light" : "dark"} />
        <View style={s.puerta}>
          <Text style={s.puertaTitulo}>Mesa de Redacción</Text>
          <Text style={s.vacioTexto}>
            Tu sesión está guardada. Desbloquéala con {bio.nombre}.
          </Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable
            onPress={() => abrirConBiometria(bio.nombre)}
            style={[s.boton, s.botonPrimario, s.botonAncho]}
            accessibilityRole="button"
          >
            <Text style={s.botonPrimarioTexto}>Desbloquear con {bio.nombre}</Text>
          </Pressable>
          <Pressable
            onPress={async () => { await salir(); setBloqueado(false); }}
            style={[s.boton, s.botonAncho]} accessibilityRole="button"
          >
            <Text style={s.botonTexto}>Entrar con la contraseña</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!dentro) {
    return (
      <Puerta
        {...{ c, s, m, oscuro, bio }}
        alEntrar={async () => {
          await cargar();
          // Se ofrece justo después del primer acierto, que es cuando se
          // entiende para qué sirve.
          if (bio.disponible && !(await preferencia())) {
            const { ok } = await desbloquear(bio.nombre);
            if (ok) { await guardarPreferencia(true); setBioActivo(true); }
          }
        }}
      />
    );
  }

  const visibles = borradores.filter((d) => (d.estado || "pendiente") === filtro);
  const cuenta = (f) => borradores.filter((d) => (d.estado || "pendiente") === f).length;

  return (
    <View style={s.pantalla}>
      <StatusBar style={oscuro ? "light" : "dark"} />

      <View style={s.cabecera}>
        <View style={s.cabeceraFila}>
          <Text style={s.titulo} numberOfLines={1} adjustsFontSizeToFit>
            Mesa de Redacción
          </Text>
          {bio.disponible && (
            <Pressable
              onPress={async () => {
                toque();
                const nuevo = !bioActivo;
                if (nuevo) {
                  const { ok } = await desbloquear(bio.nombre);
                  if (!ok) return;
                }
                await guardarPreferencia(nuevo);
                setBioActivo(nuevo);
              }}
              style={s.salir} hitSlop={10}
              accessibilityLabel={`${bioActivo ? "Desactivar" : "Activar"} ${bio.nombre}`}
            >
              <Text style={[s.salirTexto, bioActivo && { color: c.acento, fontWeight: "700" }]}>
                {bio.nombre}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={async () => {
              toque();
              await salir();
              setDentro(false);
              setBloqueado(false);
            }}
            style={s.salir} hitSlop={10} accessibilityLabel="Cerrar sesión"
          >
            <Text style={s.salirTexto}>Salir</Text>
          </Pressable>
        </View>

        <View style={s.conmutador}>
          {[{ id: "cola", nombre: `Cola${cuenta("pendiente") ? ` · ${cuenta("pendiente")}` : ""}` },
            { id: "chat", nombre: "Chat" }].map((v) => (
            <Pressable
              key={v.id} onPress={() => { toque(); setVista(v.id); }}
              style={[s.conmutadorBoton, vista === v.id && s.conmutadorVivo]}
              accessibilityRole="tab" accessibilityState={{ selected: vista === v.id }}
            >
              <Text style={[s.conmutadorTexto, vista === v.id && s.conmutadorTextoVivo]}>
                {v.nombre}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {vista === "chat" ? (
        <Chat c={c} s={s} m={m} insets={insets} token={tokenActual()} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + m.esc(96)}
        >
          <View style={s.pestanas}>
            {FILTROS.map((f) => (
              <Pressable
                key={f.id} onPress={() => { toque(); setFiltro(f.id); }}
                style={[s.pestana, filtro === f.id && s.pestanaViva]}
                accessibilityRole="tab" accessibilityState={{ selected: filtro === f.id }}
              >
                <Text style={[s.pestanaTexto, filtro === f.id && s.pestanaTextoVivo]}>
                  {f.nombre}
                </Text>
                {cuenta(f.id) > 0 && (
                  <View style={[s.pildora, filtro === f.id && s.pildoraViva]}>
                    <Text style={[s.pildoraTexto, filtro === f.id && s.pildoraTextoVivo]}>
                      {cuenta(f.id)}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {avisoPush ? <Text style={s.avisoTenue}>Sin notificaciones: {avisoPush}</Text> : null}

          <ScrollView
            contentContainerStyle={s.lista}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refrescando} tintColor={c.acento}
                onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
              />
            }
          >
            <View style={s.echar}>
              <Text style={s.echarLabel}>ALGO QUE HAS VISTO O SE TE HA OCURRIDO</Text>
              <TextInput
                style={s.echarCampo} value={idea} onChangeText={setIdea}
                multiline scrollEnabled={false}
                placeholder="Pega un post que te haya llamado la atención, o escribe la idea en bruto."
                placeholderTextColor={c.tenue} accessibilityLabel="Idea nueva"
              />
              <View style={s.echarPie}>
                <Text style={s.contador}>{idea.length ? `${idea.length} caracteres` : ""}</Text>
                <Pressable
                  onPress={echarIdea} disabled={guardando || !idea.trim()}
                  style={[s.boton, s.botonPrimario, (guardando || !idea.trim()) && s.botonApagado]}
                  accessibilityRole="button"
                >
                  <Text style={s.botonPrimarioTexto}>{guardando ? "Guardando…" : "A la cola"}</Text>
                </Pressable>
              </View>
            </View>

            {visibles.length === 0 ? (
              <View style={s.vacio}>
                <Text style={s.vacioTitulo}>{VACIO[filtro][0]}</Text>
                <Text style={s.vacioTexto}>{VACIO[filtro][1]}</Text>
              </View>
            ) : (
              visibles.map((d) => (
                <Tarjeta key={d.id} {...{ c, s, m }} borrador={d} onCambiar={cambiar} />
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Puerta({ c, s, m, oscuro, bio, alEntrar }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function probar() {
    if (!password || enviando) return;
    setEnviando(true);
    setError("");
    try {
      await entrar(password);
      toque("exito");
      await alEntrar();
    } catch (e) {
      setError(e.message);
      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
    setEnviando(false);
  }

  return (
    <KeyboardAvoidingView
      style={s.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style={oscuro ? "light" : "dark"} />
      <ScrollView contentContainerStyle={s.puerta} keyboardShouldPersistTaps="handled">
        <Text style={s.puertaTitulo}>Mesa de Redacción</Text>
        <Text style={s.vacioTexto}>Introduce la contraseña para ver la cola.</Text>
        <TextInput
          style={s.campo} value={password} onChangeText={setPassword}
          secureTextEntry autoFocus autoCapitalize="none" autoCorrect={false}
          textContentType="password" returnKeyType="go"
          placeholder="Contraseña" placeholderTextColor={c.tenue}
          onSubmitEditing={probar} accessibilityLabel="Contraseña"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable
          onPress={probar} disabled={enviando || !password}
          style={[s.boton, s.botonPrimario, s.botonAncho,
                  (enviando || !password) && s.botonApagado]}
          accessibilityRole="button"
        >
          <Text style={s.botonPrimarioTexto}>{enviando ? "Comprobando…" : "Entrar"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tarjeta({ c, s, m, borrador, onCambiar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(borrador.texto || "");
  const [copiado, setCopiado] = useState(false);
  const aparecer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(aparecer, {
      toValue: 1, duration: 220, useNativeDriver: true,
    }).start();
  }, [aparecer]);

  const estado = borrador.estado || "pendiente";
  const actual = editando ? texto : borrador.texto || "";
  const [antes, despues] = partirPorPliegue(actual);
  const avisos = revisar(actual);

  async function copiar() {
    await Clipboard.setStringAsync(actual);
    toque();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  async function abrirLinkedIn() {
    await copiar();
    const { Linking } = require("react-native");
    const url = URL_COMPOSITOR + encodeURIComponent(actual);
    Linking.openURL(url.length <= 8000 ? url : "https://www.linkedin.com/feed/");
  }

  return (
    <Animated.View
      style={[
        s.tarjeta,
        estado === "aprobado" && s.tarjetaOk,
        estado === "descartado" && s.tarjetaOff,
        { opacity: aparecer,
          transform: [{ translateY: aparecer.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <View style={s.tarjetaTop}>
        <Text style={[s.insignia, estado === "aprobado" ? s.insigniaOk
                     : estado === "descartado" ? s.insigniaOff : s.insigniaPend]}>
          {estado.toUpperCase()}
        </Text>
        <Text style={s.origen} numberOfLines={1}>{borrador.origen || "propuesta"}</Text>
      </View>

      <View style={s.cuerpo}>
        <View style={s.quien}>
          <View style={s.avatar}><Text style={s.avatarTexto}>{YO.iniciales}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.quienNombre} numberOfLines={1}>{YO.nombre}</Text>
            <Text style={s.quienRol} numberOfLines={1}>{YO.rol}</Text>
          </View>
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
            <Text style={s.post} selectable>{antes}</Text>
            {despues ? (
              <>
                <View style={s.pliegueFila}>
                  <Text style={s.pliegue}>PLIEGUE · VER MÁS</Text>
                  <View style={s.pliegueLinea} />
                </View>
                <Text style={s.post} selectable>{despues}</Text>
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
              <Pressable style={[s.boton, s.botonPrimario]}
                onPress={() => onCambiar(borrador.id, { estado: "aprobado" })}>
                <Text style={s.botonPrimarioTexto}>Aprobar</Text>
              </Pressable>
            )}
            <Pressable style={s.boton} onPress={copiar}>
              <Text style={s.botonTexto}>{copiado ? "Copiado ✓" : "Copiar"}</Text>
            </Pressable>
            <Pressable style={s.boton} onPress={abrirLinkedIn}>
              <Text style={s.botonTexto}>LinkedIn</Text>
            </Pressable>
            <Pressable style={s.boton} onPress={() => { toque(); setEditando(true); }}>
              <Text style={s.botonTexto}>Editar</Text>
            </Pressable>
            <Pressable style={s.boton}
              onPress={() => onCambiar(borrador.id,
                { estado: estado === "descartado" ? "pendiente" : "descartado" })}>
              <Text style={s.botonTexto}>
                {estado === "descartado" ? "Recuperar" : "Descartar"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );
}

function estilos(c, m, insets) {
  const lado = m.compacto ? m.e.m : m.e.l;
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: c.papel, paddingTop: insets.top },
    centro: { flex: 1, backgroundColor: c.papel, alignItems: "center", justifyContent: "center" },

    cabecera: { paddingHorizontal: lado, paddingBottom: m.e.s },
    cabeceraFila: { flexDirection: "row", alignItems: "center", gap: m.e.m },
    titulo: { flex: 1, fontSize: m.t.titulo, fontWeight: "800", color: c.tinta, letterSpacing: -0.6 },
    salir: { minHeight: m.toque, justifyContent: "center", paddingHorizontal: m.e.xs },
    salirTexto: { fontSize: m.t.menor, color: c.tenue },

    conmutador: {
      flexDirection: "row", backgroundColor: c.campo, borderRadius: m.radio,
      padding: 3, gap: 3, marginTop: m.e.xs,
    },
    conmutadorBoton: {
      flex: 1, minHeight: m.toque - 8, borderRadius: m.radio - 3,
      alignItems: "center", justifyContent: "center",
    },
    conmutadorVivo: { backgroundColor: c.tarjeta, ...sombra(c, 1) },
    conmutadorTexto: { fontSize: m.t.menor, color: c.suave, fontWeight: "600" },
    conmutadorTextoVivo: { color: c.tinta },

    pestanas: {
      flexDirection: "row", paddingHorizontal: lado,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.linea,
    },
    pestana: {
      flexDirection: "row", alignItems: "center", gap: m.e.xs,
      minHeight: m.toque, paddingHorizontal: m.e.s,
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    pestanaViva: { borderBottomColor: c.acento },
    pestanaTexto: { fontSize: m.t.menor, color: c.suave },
    pestanaTextoVivo: { color: c.tinta, fontWeight: "700" },
    pildora: { backgroundColor: c.campo, borderRadius: 99, paddingHorizontal: m.e.xs + 2, paddingVertical: 1 },
    pildoraViva: { backgroundColor: c.acentoBg },
    pildoraTexto: { fontSize: m.t.micro, color: c.tenue, fontWeight: "700" },
    pildoraTextoVivo: { color: c.acento },

    lista: { padding: lado, gap: m.e.l, paddingBottom: insets.bottom + m.e.xxl },

    echar: {
      backgroundColor: c.tarjeta, borderRadius: m.radio, padding: m.e.m, gap: m.e.s,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea, ...sombra(c, 1),
    },
    echarLabel: { fontSize: m.t.micro, fontWeight: "800", letterSpacing: 0.8, color: c.acento },
    echarCampo: {
      backgroundColor: c.campo, borderRadius: m.radio - 3, padding: m.e.m,
      minHeight: m.esc(72), color: c.tinta, fontSize: m.t.cuerpo,
      textAlignVertical: "top", lineHeight: m.t.cuerpo * 1.4,
    },
    echarPie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: m.e.s },

    tarjeta: {
      backgroundColor: c.tarjeta, borderRadius: m.radio, overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea,
      borderLeftWidth: 3, borderLeftColor: c.acento, ...sombra(c, 1),
    },
    tarjetaOk: { borderLeftColor: c.ok },
    tarjetaOff: { borderLeftColor: c.off, opacity: 0.6 },
    tarjetaTop: {
      flexDirection: "row", alignItems: "center", gap: m.e.s,
      paddingHorizontal: m.e.m, paddingVertical: m.e.s,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.lineaSuave,
    },
    insignia: {
      fontSize: m.t.micro, fontWeight: "800", letterSpacing: 0.8,
      paddingHorizontal: m.e.s, paddingVertical: 3, borderRadius: 4, overflow: "hidden",
    },
    insigniaPend: { backgroundColor: c.acentoBg, color: c.acento },
    insigniaOk: { backgroundColor: c.okBg, color: c.ok },
    insigniaOff: { backgroundColor: c.offBg, color: c.off },
    origen: { flex: 1, fontSize: m.t.etiqueta, color: c.tenue, textAlign: "right" },

    cuerpo: { padding: m.e.m },
    quien: { flexDirection: "row", alignItems: "center", gap: m.e.s, marginBottom: m.e.m },
    avatar: {
      width: m.esc(40), height: m.esc(40), borderRadius: m.esc(20),
      backgroundColor: c.avatar, alignItems: "center", justifyContent: "center",
    },
    avatarTexto: { color: "#fff", fontWeight: "800", fontSize: m.t.menor },
    quienNombre: { fontSize: m.t.menor, fontWeight: "700", color: c.tinta },
    quienRol: { fontSize: m.t.etiqueta, color: c.tenue, marginTop: 1 },

    post: { fontSize: m.t.cuerpo, lineHeight: m.t.cuerpo * 1.5, color: c.tinta },
    pliegueFila: { flexDirection: "row", alignItems: "center", gap: m.e.s, marginVertical: m.e.m },
    pliegue: { fontSize: m.t.micro, color: c.acento, letterSpacing: 0.8, fontWeight: "700" },
    pliegueLinea: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.acento, opacity: 0.35 },

    avisos: { marginTop: m.e.m, padding: m.e.m, backgroundColor: c.acentoBg, borderRadius: m.radio - 3, gap: m.e.xs },
    avisoTexto: { fontSize: m.t.etiqueta, color: c.acento },
    nota: {
      marginTop: m.e.m, padding: m.e.m, backgroundColor: c.campo,
      borderRadius: m.radio - 3, fontSize: m.t.etiqueta, color: c.suave,
    },

    area: {
      backgroundColor: c.campo, borderRadius: m.radio - 3, padding: m.e.m,
      minHeight: m.esc(200), color: c.tinta, fontSize: m.t.cuerpo,
      lineHeight: m.t.cuerpo * 1.5, textAlignVertical: "top",
    },
    contador: { fontSize: m.t.etiqueta, color: c.tenue, marginTop: m.e.xs },
    contadorPasado: { color: c.acento, fontWeight: "700" },

    acciones: {
      flexDirection: "row", flexWrap: "wrap", gap: m.e.s, padding: m.e.m,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.lineaSuave,
    },
    boton: {
      minHeight: m.toque - 8, justifyContent: "center", alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea,
      borderRadius: m.radio - 3, paddingHorizontal: m.e.m, backgroundColor: c.elevado,
    },
    botonAncho: { alignSelf: "stretch", minHeight: m.toque },
    botonTexto: { fontSize: m.t.menor, color: c.tinta, fontWeight: "500" },
    botonPrimario: { backgroundColor: c.acento, borderColor: c.acento },
    botonPrimarioTexto: { fontSize: m.t.menor, color: c.acentoTexto, fontWeight: "700" },
    botonApagado: { opacity: 0.4 },

    vacio: {
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea, borderRadius: m.radio,
      paddingVertical: m.e.xxl, paddingHorizontal: m.e.l, alignItems: "center", gap: m.e.s,
    },
    vacioTitulo: { fontSize: m.t.seccion, fontWeight: "700", color: c.tinta },
    vacioTexto: { fontSize: m.t.menor, color: c.suave, textAlign: "center", lineHeight: m.t.menor * 1.45 },

    error: { color: c.acento, fontSize: m.t.menor, paddingHorizontal: lado, paddingTop: m.e.s },
    avisoTenue: { color: c.tenue, fontSize: m.t.etiqueta, paddingHorizontal: lado, paddingTop: m.e.xs },

    puerta: { padding: m.e.xl, gap: m.e.m, flexGrow: 1, justifyContent: "center" },
    puertaTitulo: { fontSize: m.t.titulo, fontWeight: "800", color: c.tinta, letterSpacing: -0.6 },
    campo: {
      backgroundColor: c.campo, borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea,
      borderRadius: m.radio - 3, padding: m.e.m, minHeight: m.toque,
      color: c.tinta, fontSize: m.t.cuerpo,
    },

    chatLista: { padding: lado, gap: m.e.m, paddingBottom: m.e.l },
    burbuja: { padding: m.e.m, borderRadius: m.radio + 4, maxWidth: "86%" },
    burbujaMia: { alignSelf: "flex-end", backgroundColor: c.acento, borderBottomRightRadius: 4 },
    burbujaMiaTexto: { color: c.acentoTexto, fontSize: m.t.cuerpo, lineHeight: m.t.cuerpo * 1.45 },
    burbujaSuya: {
      alignSelf: "flex-start", backgroundColor: c.tarjeta, borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.linea,
    },
    burbujaSuyaTexto: { color: c.tinta, fontSize: m.t.cuerpo, lineHeight: m.t.cuerpo * 1.45 },
    chatPie: {
      flexDirection: "row", alignItems: "flex-end", gap: m.e.s,
      paddingHorizontal: lado, paddingTop: m.e.s,
      paddingBottom: Math.max(insets.bottom, m.e.s),
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linea,
      backgroundColor: c.papel,
    },
  });
}
