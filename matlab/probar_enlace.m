function datos = probar_enlace()
% Active Automatico en la bola levitadora antes de ejecutar esta funcion.
% MATLAB base: prueba de mando abierto (sin PID).
client = tcpclient('127.0.0.1',5050,'Timeout',3);
client.ByteOrder = 'little-endian';
Ts = 0.01;
write(client,[0 0 0 Ts],'double');
initial = read(client,8,'double');
assert(numel(initial)==8 && initial(1)==0 && initial(8)==1,'Respuesta inicial incorrecta');
datos = zeros(300,8);
for k = 1:size(datos,1)
    write(client,[1 k 0.5 Ts],'double');
    values = read(client,8,'double');
    assert(numel(values)==8 && values(1)==k && values(8)==1,'Respuesta fuera de secuencia');
    datos(k,:) = values;
    pause(Ts); % Solo para visualizar a una velocidad aproximada al tiempo real.
end
clear client
plot(datos(:,2),datos(:,3)); xlabel('Tiempo simulado (s)'); ylabel('Altura (m)'); grid on
end
