classdef EstabilizaBall < matlab.System
    % MATLAB System block. MATLAB + Simulink; no Instrument Control Toolbox.
    properties (Nontunable)
        Port = 5050
        SampleTime = 0.01
    end
    properties (Access = private)
        Client
    end
    properties (DiscreteState)
        Sequence
        Measurement
    end
    methods (Access = protected)
        function setupImpl(obj)
            validateattributes(obj.SampleTime,{'double'},{'scalar','>=',0.001,'<=',0.1});
            obj.Client = tcpclient('127.0.0.1',obj.Port,'Timeout',3);
            obj.Client.ByteOrder = 'little-endian';
            resetImpl(obj);
        end
        function resetImpl(obj)
            obj.Sequence = 0;
            obj.Measurement = exchange(obj,0,0);
        end
        function [height,velocity] = outputImpl(obj,~)
            height = obj.Measurement(3);
            velocity = obj.Measurement(4);
        end
        function updateImpl(obj,u)
            validateattributes(u,{'double'},{'real','scalar','finite','>=',0,'<=',1});
            obj.Sequence = obj.Sequence + 1;
            obj.Measurement = exchange(obj,1,u);
        end
        function releaseImpl(obj)
            obj.Client = [];
        end
        function flag = isInputDirectFeedthroughImpl(~,~)
            flag = false; % y[k] precedes u[k]; no algebraic loop.
        end
        function n = getNumInputsImpl(~), n = 1; end
        function n = getNumOutputsImpl(~), n = 2; end
        function [a,b] = getOutputSizeImpl(~), a=[1 1]; b=[1 1]; end
        function [a,b] = getOutputDataTypeImpl(~), a='double'; b='double'; end
        function [a,b] = isOutputComplexImpl(~), a=false; b=false; end
        function [a,b] = isOutputFixedSizeImpl(~), a=true; b=true; end
        function [sz,type,complexity] = getDiscreteStateSpecificationImpl(~,name)
            if strcmp(name,'Measurement'), sz=[1 8]; else, sz=[1 1]; end
            type='double'; complexity=false;
        end
        function st = getSampleTimeImpl(obj)
            st = createSampleTime(obj,'Type','Discrete','SampleTime',obj.SampleTime);
        end
    end
    methods (Static, Access = protected)
        function value = getSimulateUsingImpl(), value='Interpreted execution'; end
    end
    methods (Access = private)
        function values = exchange(obj,operation,u)
            write(obj.Client,[operation obj.Sequence u obj.SampleTime],'double');
            values = read(obj.Client,8,'double');
            if numel(values)~=8 || any(~isfinite(values)) || values(1)~=obj.Sequence || values(8)~=1
                error('Estabiliza:Protocol','Respuesta incompleta o fuera de secuencia. Detenga el modelo y reactive Automático.');
            end
        end
    end
end
