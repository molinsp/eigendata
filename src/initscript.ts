export const python_initialization_script = `
import json
import sys
from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics


_jupyterlab_variableinspector_nms = NamespaceMagics()
_jupyterlab_variableinspector_Jupyter = get_ipython()
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell


def _jupyterlab_variableinspector_keep_dataframes(v):
    try:
        obj = eval(v)
        # Check if datadrame
        if isinstance(obj, pd.core.frame.DataFrame) or isinstance(obj,pd.core.series.Series):
            return True
        return False
    except:
        return False

def _jupyterlab_variableinspector_dict_list():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vardic = [{'varName': _v} for _v in values if _jupyterlab_variableinspector_keep_dataframes(_v)]
    return json.dumps(vardic, ensure_ascii=False)

def _jupyterlab_variableinspector_array():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if _jupyterlab_variableinspector_keep_dataframes(_v)]
    return vararray


custom_config = {
    'read_csv' : {
        'included_parameters' : ['filepath_or_buffer','sep','delimiter','decimal'],
    },
    'merge' : {
        'included_parameters' : ['right','how','left_on','right_on'],
    },
    'pivot_table' : {
        'parameters' : {
            'aggfunc':{
                    'type' : 'array',
                    'title' : 'Aggregations',
                    'items': {
                            'type' : 'object',
                            'title': 'aggregation',
                            'properties': {
                                'function' : {
                                    'type' : 'string',
                                    'enum' : ['np.mean', 'count'],
                                    'enumNames' : ['Mean', 'Count']
                                    },
                            'column' : {
                                'type' : 'string',
                                '$ref' : '#/definitions/column'
                                }
                                
                            }
                        
                    }         
                }
        }
    }    
}

from numpydoc.docscrape import NumpyDocString
import re
import json
def get_multi_select_values(function, caller=None, debug=False):
    """
    This function takes a pandas function an returns a parameter configuration that allows us to build a graphical
    user interface
    """
    doc = NumpyDocString(function.__doc__)
    
    function_name = function.__name__
    
    # Check if there is a custom function config
    has_custom_config = 0
    if(function_name in custom_config):
        if debug: print('Has custom config for function: ' + function_name)
        has_custom_config = 1
    
    # Check if there is a custom parameter config
    has_custom_parameters_config = 0
    if((has_custom_config == 1) and 'parameters' in custom_config[function_name]):
        if debug: print('Has custom parameter config for function: '  + function_name)
        has_custom_parameters_config = 1
        
    # Check if there is a custom parameter list
    has_custom_parameters_list = 0
    if((has_custom_config == 1) and 'included_parameters' in custom_config[function_name]):
        if debug: print('Has custom parameter list for function'  + function_name)
        has_custom_parameters_list = 1
        
    # Iterate over all parameters
    # ------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------
    
    parameter_configuration = {'properties': {}}
    parameter_configuration['type'] = 'object'
    parameter_configuration['title'] = function_name
    parameter_configuration['required'] = []
    for i in doc['Parameters']:
        if debug: print('---------------------------------------- ' + i.name )
        # CHECK FOR CUSTOM CONFIGS
        # ------------------------------------------------------------------------------------------
        # ------------------------------------------------------------------------------------------
       
        # Check if the parameter is excluded 
        if has_custom_parameters_list == 1:
            if((has_custom_config == 1) and i.name in custom_config[function_name]['included_parameters']):
                if debug: print(i.name + '  is included in the custom parameter list')
                pass
            else:
                # Skip the config
                continue
        
        # Check if there is custom parameter config
        has_custom_config_parameter = 0
        custom_parameter_config = {}
        if has_custom_parameters_config == 1:           
            if((has_custom_config == 1) and i.name in custom_config[function_name]['parameters']):
                if debug: print('Reading custom parameter config for parameter:', i.name)
                has_custom_config_parameter = 1
                custom_parameter_config = custom_config[function_name]['parameters'][i.name]
        
        
        # CREATE THE OUTPUT
        # ------------------------------------------------------------------------------------------
        # ------------------------------------------------------------------------------------------
        parameter_description = {}
        parameter_description[i.name] = {}
        
        # 1. PARAMETER TYPE
        # ------------------------------------------------------------------------------------------
        # Check for custom config
        if 'type' in custom_parameter_config:
            if debug: print('Set parameter type for ' + i.name + ' as ' + custom_parameter_config['type'] )
            parameter_description[i.name]['type'] = custom_parameter_config['type'] 
            if custom_parameter_config['type'] == 'array':
                parameter_description[i.name]['items'] = custom_parameter_config['items'] 
            elif custom_parameter_config['type'] == 'object':
                parameter_description[i.name] = custom_parameter_config
        # Automatic check
        elif 'column' in i.type:
            if 'list' in i.type:
                if debug: print('Set parameter type for ' + i.name + ' as ' + 'column list' )
                parameter_description[i.name]['$ref'] = '#/definitions/columns'
            else:
                if debug: print('Set parameter type for ' + i.name + ' as ' + 'column' )
                parameter_description[i.name]['$ref'] = '#/definitions/column'
        elif 'label' in i.type:
            if 'list' in i.type:
                if debug: print('Set parameter type for ' + i.name + ' as ' + 'label list' )
                parameter_description[i.name]['$ref'] = '#/definitions/columns'
            else:
                if debug: print('Set parameter type for ' + i.name + ' as ' + 'label' )
                parameter_description[i.name]['$ref'] = '#/definitions/column'
            # To-do add also row labels
        elif 'DataFrame' in i.type:
            parameter_description[i.name]['type'] = 'string'
            parameter_description[i.name]['enum'] = _jupyterlab_variableinspector_array()
            parameter_description[i.name]['codegenstyle'] = 'variable'
        elif 'function' in i.type:
            parameter_description[i.name]['type'] = 'string'
        elif 'scalar' in i.type:
            parameter_description[i.name]['type'] = 'integer'
        elif 'int' in i.type:
            parameter_description[i.name]['type'] = 'integer'
        elif 'bool' in i.type:
            parameter_description[i.name]['type'] = 'boolean'
        elif 'str' in i.type:
            parameter_description[i.name]['type'] = 'string'
        else:
            parameter_description[i.name]['type'] = 'string'

        
        
        # 3. CHECK FOR OPTIONS
        # ------------------------------------------------------------------------------------------
        # Check for custom config
        if 'values' in custom_parameter_config:
            parameter_description[i.name]['values'] = custom_parameter_config['values'] 
        # Automatic check: Check if the parameter has specific set of values given
        elif '{' in i.type:
            options = re.search('{(.*)}', i.type).group(1)
            options = options.replace('"', '')
            options = options.replace("'", '')
            options = options.replace(' ', '')
            options = options.split(',')
            #options = options.replace('"', '').replace(' ', '').split(',')
            parameter_description[i.name]['enum'] = options


        # 3. DETERMINE SELECTOR TYPE
        # ------------------------------------------------------------------------------------------     
        if 'selector_type' in custom_parameter_config:
            #print('selecto type from config')
            parameter_description[i.name]['selector_type'] = custom_parameter_config['selector_type'] 
        # Automatic check: Check if more than one input can be given             
        #elif 'list' in i.type:
        #    parameter_description[i.name]['selector_type'] = 'multiselect'
        #elif 'str' in i.type:
        #    parameter_description[i.name]['selector_type'] = 'text'
        #else:
        #    parameter_description[i.name]['selector_type'] = 'singleselect'
        
        # 4. OPTIONAL VS REQUIRED
        # ------------------------------------------------------------------------------------------
        if 'optional' not in i.type:
            parameter_configuration['required'].append(i.name)
            
        # 5. DEFAULT VALUE
        # ------------------------------------------------------------------------------------------
        if 'default is' in i.type:
                default_index = i.type.find('default is') + 11
                default_val = i.type[default_index:]
                # Clean the string
                default_val = default_val.strip("'")
                parameter_description[i.name]['default'] = default_val      
        elif 'default' in i.type:
                default_index = i.type.find('default') + 8
                default_val = i.type[default_index:]
                # Clean the string
                default_val = default_val.strip("'")
                parameter_description[i.name]['default'] = default_val
        
        parameter_configuration['properties'].update(parameter_description) 
        
    parameter_configuration['properties']['New table'] = {'type': 'string'};
    
    parameter_configuration['definitions'] =  {
        'columns' :     {
            'type' : 'array',
            'uniqueItems' : True,
            'items' : {
                'type' : 'string',
                'enum' : []
            }
        },
        'column' :     {
            'type' : 'string',
            'enum' : []
        }
    }    
    parameter_configuration['definitions']['columns']['items']['enum'] = caller.columns.tolist()
    parameter_configuration['definitions']['column']['enum'] = caller.columns.tolist()
    
    res = json.dumps(parameter_configuration, ensure_ascii=False) 
    return json.dumps(parameter_configuration, ensure_ascii=False) 


def get_json_column_values(caller):
    return json.dumps(caller.columns.tolist(), ensure_ascii=False)

def generate_querybuilder_config(df):
    queryprops = {}
    for i,col_type in enumerate(df.dtypes):
        col_name = df.columns[i]
        if col_type == 'int64':      
            if set(df[col_name].unique()) == {0,1}:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'boolean'
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'number'
                }
        elif col_type == 'float64':
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'number'
            }
        elif col_type == 'object':
            # Categorical if less than 10% of values are unique
            if (df[col_name].nunique() / df[col_name].count() * 100.0 < 10):
                queryprops[col_name] = {
                'label' : col_name,
                'type' : 'select',
                'fieldSettings' : {
                    'listValues' : [{'value': i, 'title': i} for i in df[col_name].unique()]
                    }
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'text'
                }
    return json.dumps(queryprops, ensure_ascii=False)
`;