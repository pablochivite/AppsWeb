 funcionalidad en la que se te genera un training system (ciclo semanal de entrenamiento + sesiones completas de la primera semana) con LangGraph desde TypeScript

Inputs (firebase)
Coleccion Users: quiero extraer los siguientes datos del usuario
baselinemetrics.mobility
baselinemetrics.flexibility
baselinemetrics.rotation
discomforts
objectives
preferredDiscipline

Subcoleccion variations (coleccion dentro de la colección exercises):
todas las variations --> lo que conforma las sesiones. Las variaciones están dentro de la colección ‘ejercicios’, pues es la VARIACIÓN de un ejercicio la que realmente hace un usuario durante la sesión. Cada ejercicio tiene variaciones. Estas variaciones son lo que el humano entiende como 'ejercicios'.
name
disciplines
tags

Output (deseado)
weeklyPlan: estructura semanal de entrenamiento permanente basada en los datos del usuario. Aquí se se especifica qué días a la semana se entrenará y dónde estará el focus cada uno de esos training days. TIENE QUE ESTAR ALINEADO CON FUERZA + ENFOQUE HOLÍSTICO: El plan semanal debe cubrir basicamente todos los grupos musculares (balance) mientras busca ganar fuerza.

El weeklyPlan tiene 5 CAMPOS: nº training days en el plan, qué dias se entrena, fecha de cada sesion que se va a generar, descripcion clara y propósito cada training day, descripcion clara y proposito del traning system

Sesiones: Contenedores de variaciones de esos training days. constan siempre de 3 fases: warmup, workout, cooldown. Cada fase la conforman variaciones que cumplan con las características de la fase.
Warmup: cardio, mobility, core —> 3-5 variaciones
Workout: addressea el propósito de la sesión mas especificamente —> 4-6 variaciones
Cooldown: mobility, flexibility —>3-4 variaciones

Las sesiones deben cambiar para el mismo training day por nuestro principio de variabilidad. Como ejemplo, si el entrenamiento de los lunes se centra en pierna, la sesion de este lunes y la del proximo debe contener variaciones diferentes aunque se ejercite el mismo grupo muscular.

Es indispensable seguir best practices:
se deben utilizar prompt templates: inyectando {variables}

Se debe utilizar function/tool calling en lugar del ReAct framework: la pasamos un JSON con la definicion de las funciones para que el modelo devuelva un JSON estructurado garantizado.
Lo más importante yo creo (más allá de la constitución de sesiones, que es más determinista al final), es que se creen planes con sentido, criterio y balanceados. O sea, que en el plan que genere para la semana (que será permanente para todas las semanas) se entrene todo el cuerpo (en la forma que IA estime conveniente basandose en los datos del user + variaciones).  El plan semanal será permanente, pero las sesiones NO! Esto es crucial para añadir variabilidad a la forma de entrenar. Que la IA ingenie sesiones para entrenar los mismos grupos musculares con diferentes ejercicios es la forma más eficaz (de ganar fuerza de verdad) de plasmar mi visión holística en el proyecto. Al final la generacion de sesiones puede llegar a ser bastante determinista, lo que importa es no repetir la misma sesion cada vez que me toca entrenar el mismo grupo muscular.
