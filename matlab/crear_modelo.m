function crear_modelo(showModel)
% Genera un ejemplo minimo con bloques de Simulink base, sin toolboxes extra.
addpath(fileparts(mfilename('fullpath')));
if nargin==0, showModel=true; end
model = 'Estabiliza_Bola';
if bdIsLoaded(model), if showModel, open_system(model); end; return; end
new_system(model);
add_block('simulink/Sources/Constant',[model '/Mando'],'Value','0.5','Position',[60 80 100 110]);
add_block('simulink/User-Defined Functions/MATLAB System',[model '/Planta'], ...
    'System','EstabilizaBall','Position',[190 60 350 140]);
add_block('simulink/Sinks/Scope',[model '/Altura'],'Position',[430 62 475 98]);
add_block('simulink/Sinks/Terminator',[model '/Velocidad'],'Position',[435 120 455 140]);
add_line(model,'Mando/1','Planta/1'); add_line(model,'Planta/1','Altura/1'); add_line(model,'Planta/2','Velocidad/1');
set_param(model,'SolverType','Fixed-step','Solver','FixedStepDiscrete','FixedStep','0.01','StopTime','3');
if showModel, open_system(model); end
% Modelo en memoria: guardar manualmente donde el estudiante prefiera.
end
